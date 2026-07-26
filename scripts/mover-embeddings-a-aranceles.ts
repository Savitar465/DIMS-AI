/**
 * Copia los embeddings de `dimsai.arancel_embedding` a
 * `aranceles.buscador_arancelario.arancel_embedding`.
 *
 *   npx ts-node -r dotenv/config scripts/mover-embeddings-a-aranceles.ts
 *
 * Se hace por script y no por SQL porque Postgres no consulta entre bases,
 * aunque estén en la misma instancia.
 *
 * Copia, no mueve: la tabla de origen queda intacta. Regenerar estos vectores
 * cuesta cuota de la API, así que borrar el origen es una decisión aparte y
 * manual, para tomar recién cuando el destino esté verificado.
 *
 * Es idempotente: se puede correr las veces que haga falta.
 */
import { Client } from 'pg';

const LOTE = 200;

function requerido(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

async function main() {
  const origen = new Client({
    host: requerido('DATABASE_HOST'),
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: requerido('DATABASE_USER'),
    password: requerido('DATABASE_PASSWORD'),
    database: requerido('DATABASE_NAME'),
    ssl: { rejectUnauthorized: false },
  });
  const destino = new Client({
    host: requerido('ARANCEL_DB_HOST'),
    port: parseInt(process.env.ARANCEL_DB_PORT ?? '5432', 10),
    user: requerido('ARANCEL_DB_USER'),
    password: requerido('ARANCEL_DB_PASSWORD'),
    database: requerido('ARANCEL_DB_NAME'),
    ssl: process.env.ARANCEL_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    statement_timeout: 120000,
  });

  await origen.connect();
  await destino.connect();

  try {
    const { rows } = await origen.query<{
      codigo: string;
      capitulo: string;
      texto: string;
      embedding: string;
      modelo: string;
    }>(
      // pgvector devuelve el vector como texto "[0.1,0.2,...]", que es
      // exactamente lo que acepta el cast de vuelta a ::vector.
      `SELECT codigo, capitulo, texto, embedding::text AS embedding, modelo
         FROM arancel_embedding ORDER BY codigo`,
    );
    console.log(`En origen (dimsai): ${rows.length} embeddings`);
    if (rows.length === 0) return;

    let copiados = 0;
    for (let i = 0; i < rows.length; i += LOTE) {
      const lote = rows.slice(i, i + LOTE);
      const valores: string[] = [];
      const params: any[] = [];

      lote.forEach((r, j) => {
        const b = j * 5;
        valores.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}::vector, $${b + 5})`);
        params.push(r.codigo, r.capitulo, r.texto, r.embedding, r.modelo);
      });

      await destino.query(
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

      copiados += lote.length;
      console.log(`  ${copiados}/${rows.length}`);
    }

    // Verificación: no alcanza con contar, hay que confirmar que los vectores
    // llegaron iguales. Un cast mal hecho daría el mismo conteo con datos rotos.
    const muestra = rows[Math.floor(rows.length / 2)];
    const { rows: check } = await destino.query<{ igual: boolean }>(
      `SELECT (embedding::text = $2) AS igual
         FROM buscador_arancelario.arancel_embedding WHERE codigo = $1`,
      [muestra.codigo, muestra.embedding],
    );
    const { rows: total } = await destino.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM buscador_arancelario.arancel_embedding`,
    );

    console.log(`\nEn destino (aranceles): ${total[0].n} embeddings`);
    console.log(
      `Vector de control (${muestra.codigo}): ${check[0]?.igual ? 'idéntico' : 'DISTINTO — revisar'}`,
    );
    if (!check[0]?.igual) process.exitCode = 1;
  } finally {
    await origen.end().catch(() => undefined);
    await destino.end().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
