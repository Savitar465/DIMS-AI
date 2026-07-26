/**
 * Genera los embeddings del arancel para la búsqueda semántica (fase 5).
 *
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-embeddings.ts
 *
 * Lee las hojas del arancel, las embebe con Gemini y guarda los vectores en la
 * misma base (`aranceles`, esquema buscador_arancelario).
 *
 * Es reanudable: solo procesa lo que falta o lo que cambió de texto o modelo.
 * Si se corta por cuota, se vuelve a correr y sigue donde quedó.
 */
import { Client } from 'pg';

const MODELO = 'gemini-embedding-001';
const DIMENSIONES = 768;
const TAM_LOTE = 50;
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:batchEmbedContents`;

interface Hoja {
  codigo: string;
  capitulo: string;
  texto: string;
}

function requerido(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Un lote de textos → un lote de vectores.
 *
 * `taskType: RETRIEVAL_DOCUMENT` no es cosmético: los modelos de embedding
 * proyectan documentos y consultas en espacios distintos, y usar el tipo
 * equivocado degrada la recuperación de forma silenciosa.
 */
async function embeber(textos: string[], apiKey: string): Promise<number[][]> {
  const body = {
    requests: textos.map((text) => ({
      model: `models/${MODELO}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: DIMENSIONES,
    })),
  };

  for (let intento = 0; ; intento++) {
    const res = await fetch(`${API}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json: any = await res.json();
      return (json.embeddings ?? []).map((e: any) => e.values as number[]);
    }

    const txt = await res.text().catch(() => '');
    const esCuota = res.status === 429;
    if (!esCuota || intento >= 5) {
      throw new Error(`Gemini ${res.status}: ${txt.slice(0, 300)}`);
    }
    const m = txt.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
    const espera = Math.min((m ? parseFloat(m[1]) : 2 ** intento) * 1000 + 1000, 60000);
    console.log(`   cuota agotada, esperando ${Math.round(espera / 1000)}s...`);
    await dormir(espera);
  }
}

async function main() {
  const apiKey = requerido('GEMINI_API_KEY');

  const arancel = new Client({
    host: requerido('ARANCEL_DB_HOST'),
    port: parseInt(process.env.ARANCEL_DB_PORT ?? '5432', 10),
    user: requerido('ARANCEL_DB_USER'),
    password: requerido('ARANCEL_DB_PASSWORD'),
    database: requerido('ARANCEL_DB_NAME'),
    ssl: process.env.ARANCEL_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    statement_timeout: 120000,
  });

  await arancel.connect();

  try {
    // La ruta completa es la mejor representación semántica que hay: incluye
    // la mercancía, su categoría y el criterio que la distingue de sus
    // hermanas. La hoja sola diría "Los demás".
    const { rows: hojas } = await arancel.query<Hoja>(
      `SELECT codigo, capitulo,
              coalesce(ruta_legible, desc_hoja, codigo_fmt) AS texto
         FROM buscador_arancelario.arancel_busqueda
        ORDER BY codigo`,
    );
    console.log(`Hojas en el arancel: ${hojas.length}`);

    const { rows: existentes } = await arancel.query<{ codigo: string; texto: string }>(
      `SELECT codigo, texto FROM buscador_arancelario.arancel_embedding WHERE modelo = $1`,
      [MODELO],
    );
    const yaEmbebido = new Map(existentes.map((r) => [r.codigo, r.texto]));

    const pendientes = hojas.filter((h) => yaEmbebido.get(h.codigo) !== h.texto);
    console.log(`Ya embebidas: ${hojas.length - pendientes.length} · Pendientes: ${pendientes.length}`);
    if (pendientes.length === 0) {
      console.log('Nada que hacer.');
      return;
    }

    let hechas = 0;
    const t0 = Date.now();

    for (let i = 0; i < pendientes.length; i += TAM_LOTE) {
      const lote = pendientes.slice(i, i + TAM_LOTE);
      // El modelo tiene un tope de tokens por texto; 2.000 caracteres cubren
      // de sobra la ruta más larga del arancel (1.583).
      const vectores = await embeber(
        lote.map((h) => h.texto.slice(0, 2000)),
        apiKey,
      );

      if (vectores.length !== lote.length) {
        throw new Error(
          `El lote devolvió ${vectores.length} vectores para ${lote.length} textos`,
        );
      }

      // Un INSERT por lote, con los valores desplegados en parámetros.
      const valores: string[] = [];
      const params: any[] = [];
      lote.forEach((h, j) => {
        const base = j * 5;
        valores.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::vector, $${base + 5})`,
        );
        params.push(h.codigo, h.capitulo, h.texto, JSON.stringify(vectores[j]), MODELO);
      });

      await arancel.query(
        `INSERT INTO buscador_arancelario.arancel_embedding
           (codigo, capitulo, texto, embedding, modelo)
         VALUES ${valores.join(', ')}
         ON CONFLICT (codigo) DO UPDATE SET
           capitulo   = EXCLUDED.capitulo,
           texto      = EXCLUDED.texto,
           embedding  = EXCLUDED.embedding,
           modelo     = EXCLUDED.modelo,
           updated_at = now()`,
        params,
      );

      hechas += lote.length;
      const seg = (Date.now() - t0) / 1000;
      const restantes = Math.round(((pendientes.length - hechas) * seg) / hechas);
      console.log(
        `  ${hechas}/${pendientes.length} (${Math.round((hechas / pendientes.length) * 100)}%) · faltan ~${restantes}s`,
      );
    }

    console.log(`\nListo: ${hechas} embeddings en ${Math.round((Date.now() - t0) / 1000)}s`);
  } finally {
    await arancel.end().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
