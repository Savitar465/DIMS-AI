# Base de datos: configuración, preparación y funcionamiento

Todo lo necesario para levantar el backend desde cero, entender por qué la
búsqueda arancelaria está armada así y mantenerla cuando cambie el arancel.

Está pensado para alguien que llega al proyecto sin contexto previo. Si solo
necesitás dejarlo andando, la sección 3 alcanza.

---

## 1. Panorama

El sistema usa **dos bases de datos distintas**:

| Base | Qué guarda | Quién la administra |
| --- | --- | --- |
| `dimsai` | Facturas, DIMS, caché de IA, clasificaciones aprendidas | TypeORM, con `synchronize` |
| `aranceles` | El Arancel 2026, notas legales, sinónimos, embeddings | Scripts SQL en `db/migrations/` |

Hoy las dos viven en la misma instancia de Aiven, pero **son bases separadas y
por eso hacen falta dos conexiones**: Postgres no permite consultar entre bases,
ni siquiera dentro del mismo servidor. Por eso el backend levanta un
`DataSource` propio para el arancel (`arancel.datasource.ts`) además del que
maneja el módulo TypeORM.

Los dos regímenes de administración no son un descuido:

- Las tablas de la app son del proyecto y evolucionan con el código, así que las
  maneja TypeORM.
- El arancel lo carga otro proceso, se recarga entero cada año y sus tablas
  tienen nombres con espacios (`"Arancel Completo 2026"`). Que TypeORM intentara
  sincronizar un esquema contra él sería destructivo: por eso ese `DataSource`
  va con `synchronize: false` y sin entidades registradas, y todo se consulta
  con SQL crudo.

> **Cuidado con `synchronize: true`** en la conexión de la app
> (`app.module.ts`). Es cómodo en desarrollo, pero en producción TypeORM puede
> alterar o borrar columnas para hacer coincidir el esquema con las entidades.
> Antes de un despliegue serio conviene pasarlo a migraciones.

---

## 2. Conceptos necesarios

La búsqueda no es un `LIKE`. Estos son los conceptos que aparecen en el SQL y en
el código, y sin los cuales el resto no se entiende.

### 2.1 Hoja declarable

La tabla del arancel tiene **11.773 filas**, pero solo **8.132 son declarables**.
El resto son niveles intermedios del árbol (capítulos, partidas, subpartidas de
6 dígitos) que existen para dar contexto legal, no para poner en una DIMS.

Una **hoja** es un código que ningún otro código extiende. Declarar un código no
declarable hace que la aduana rechace la declaración, así que la vista de
búsqueda expone únicamente las hojas.

> No usar los campos `Padre_Nivel_*` para deducirlo: están incompletos en ambos
> sentidos. `2903.77` tiene 16 descendientes, pero ninguno la referencia como
> padre. El criterio correcto es por prefijo de código.

### 2.2 Vista materializada

`buscador_arancelario.arancel_busqueda` es la superficie de búsqueda: las 8.132
hojas, con las columnas que importan y los vectores de texto **precalculados**.

Es materializada —una tabla real, no una consulta guardada— porque calcular los
`tsvector` en cada búsqueda costaría más que la búsqueda misma. La contrapartida
es que hay que refrescarla cuando cambian los datos de origen (sección 6).

No toca las tablas originales, que quedan tal como llegaron.

### 2.3 Búsqueda de texto completo (FTS)

Postgres convierte texto en un `tsvector`: la lista de raíces de las palabras con
sus posiciones. `"Máquinas automáticas"` se convierte en `'maquin' 'automat'`.
La consulta se convierte en un `tsquery` y se comparan con el operador `@@`.

Dos piezas propias del proyecto:

- **Configuración `es_unaccent`**: español con el diccionario `unaccent`
  encadenado. Sin esto, `articulo` no encuentra `artículo` — y el arancel está
  lleno de acentos mientras que la gente escribe sin ellos.
- **Pesos**: cada parte del texto entra con una etiqueta A, B o C, y el ranking
  las pondera distinto (A vale 1,0; B 0,4; C 0,2).

  | Peso | Contenido |
  | --- | --- |
  | A | Texto legal propio de la subpartida |
  | B | Ruta jerárquica completa + descripciones mínimas |
  | C | Descripción del capítulo |

  Así, encontrar "café" en el texto de la subpartida pesa más que encontrarlo en
  la glosa heredada del capítulo, que es la diferencia que importa.

### 2.4 `ts_rank` y no `ts_rank_cd`

Postgres trae dos funciones de ranking. `ts_rank_cd` además mide la proximidad
entre términos.

**Medido sobre esta base: `ts_rank_cd` cuesta ~195 µs por fila contra ~3 µs de
`ts_rank`, 65 veces más.** En descripciones de una línea la proximidad no aporta
nada. Usar la primera llevó una consulta de 33 ms a 574 ms.

### 2.5 Trigramas

`pg_trgm` parte el texto en grupos de tres caracteres y mide qué fracción
comparten dos cadenas. Sirve para tolerar errores de tipeo, donde el FTS falla
porque la palabra mal escrita no comparte raíz.

Se aplica solo sobre el texto corto de la hoja: calcularlo sobre la ruta
completa (237 caracteres de promedio) era una parte grande del costo.

### 2.6 Expansión de sinónimos

Tabla `sinonimos`: traduce vocabulario comercial al del arancel **antes** de
buscar. Es necesaria porque muchos términos corrientes no existen en el texto
legal: de 33 términos comunes probados, **16 no aparecen nunca** (`mouse`,
`laptop`, `polera`, `chompa`, `calamina`, `garrafa`...).

Sin ella, `mouse usb` devolvía cero resultados.

Va en tabla y no en un diccionario `thesaurus` de Postgres porque un thesaurus
necesita un archivo en `$SHAREDIR/tsearch_data` del servidor: no se despliega por
SQL y se pierde en cualquier migración de la base.

### 2.7 Embeddings y similitud coseno

Un embedding es un vector de 768 números que representa el significado de un
texto. Dos textos parecidos quedan cerca aunque no compartan palabras — que es
justo lo que el FTS no puede hacer.

`pgvector` guarda esos vectores y los compara con el operador `<=>` (distancia
coseno: 0 idéntico, 2 opuesto). El índice **HNSW** acelera la búsqueda de
vecinos.

> **`taskType` importa.** Los modelos de embedding proyectan documentos y
> consultas en espacios distintos. El catálogo se embebe con
> `RETRIEVAL_DOCUMENT` y las consultas con `RETRIEVAL_QUERY`. Usar el mismo en
> los dos lados degrada la recuperación en silencio, sin ningún error visible.

### 2.8 Fusión por rango recíproco (RRF)

Cuando se combinan resultados léxicos y semánticos hay que ordenarlos juntos.
No se pueden sumar los puntajes: el léxico es una suma sin tope y la similitud
coseno va de 0 a 1.

RRF ignora los puntajes y usa solo la **posición**: cada resultado suma
`1 / (60 + posición)` por cada motor que lo encontró. La posición siempre
significa lo mismo, la escala de puntaje no.

### 2.9 Reglas Generales de Interpretación (RGI)

Las seis reglas legales que definen cómo se clasifica una mercancía. En el
código aparecen tres:

- **RGI 1** — mandan el texto de la partida y las Notas legales de sección y
  capítulo, por encima de cualquier parecido comercial. Por eso el prompt de
  clasificación incluye las notas del capítulo.
- **RGI 3a** — ante la duda, gana la descripción más específica.
- **RGI 6** — solo se compara entre subpartidas del mismo nivel. Por eso los
  candidatos incluyen las "hermanas" de los mejores resultados: sin ellas el
  modelo no puede aplicar la regla.

---

## 3. Puesta en marcha

### 3.1 Variables de entorno

```bash
cp .env.example .env
```

Y completar. El detalle de cada variable está en el propio archivo; lo mínimo
para que la búsqueda funcione son las dos conexiones. `GEMINI_API_KEY` solo hace
falta para clasificar y para generar embeddings: **la búsqueda manual anda sin
ella**.

### 3.2 Preparar la base del arancel

Los datos de origen (`"Arancel Completo 2026"` y `"Notas Tecnicas"` en el
esquema `buscador_arancelario`) se cargan por fuera de este proyecto. Con eso ya
en la base, se aplican las migraciones **en orden**:

```bash
# Cadena de conexión a la base del arancel (mismos valores que ARANCEL_DB_* del
# .env). Quitar ?sslmode=require si el servidor no exige TLS.
ARANCEL_URL="postgresql://USUARIO:CLAVE@HOST:PUERTO/aranceles?sslmode=require"

for f in db/migrations/*.sql; do
  echo "→ $f"
  psql "$ARANCEL_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

`ON_ERROR_STOP=1` es importante: sin eso `psql` sigue de largo ante un error y
podés terminar con la base a medias sin enterarte — que es exactamente lo que ya
pasó una vez en este proyecto.

**Las cinco corren sobre `aranceles`**, no sobre `dimsai`.

El orden importa: `003` reemplaza la función `buscar_subpartidas` que crea
`001`, para agregarle la expansión de sinónimos. Aplicarlas al revés deja la
versión vieja.

Qué hace cada una:

| Archivo | Qué crea |
| --- | --- |
| `001` | Extensiones, configuración FTS, vista materializada, índices, `buscar_subpartidas` |
| `002` | `candidatos_clasificacion` y `notas_para_prompt`, para el prompt del LLM |
| `003` | Tabla `sinonimos` + 25 entradas, `expandir_terminos`, y reemplaza `buscar_subpartidas` |
| `004` | `arancel_embedding` con pgvector e índice HNSW |
| `005` | Repone la nota legal del capítulo 07, que se perdió en una migración de datos |

Son **idempotentes**: se pueden volver a correr tal cual.

> No hay ejecutor automático de migraciones. Se aplican a mano, con `psql` o
> cualquier cliente. Es una deuda conocida.

### 3.3 Preparar la base de la app

No hay que hacer nada: TypeORM crea las tablas al arrancar (`synchronize: true`).

### 3.4 Verificar

```sql
-- Debe dar 8132 y 0
SELECT count(*) AS hojas,
       count(*) FILTER (WHERE length(codigo) <> 10) AS no_declarables
FROM buscador_arancelario.arancel_busqueda;

-- Debe devolver 8471.30.00.90 — prueba extensiones, FTS, vista y sinónimos
SELECT codigo_fmt FROM buscador_arancelario.buscar_subpartidas('laptop', 1);
```

Si lo segundo devuelve vacío pero lo primero da 8132, casi seguro falta correr
`003` o falló la creación de la configuración `es_unaccent`.

Y de punta a punta:

```bash
npm run start:dev
curl "http://localhost:3001/api/arancel/subpartidas?q=cafe%20tostado%20molido"
```

---

## 4. Embeddings (búsqueda semántica)

Es opcional: sin ella el sistema funciona, solo pierde los casos que ningún
sinónimo anticipó.

```bash
npm run embeddings:backfill
```

Recorre las 8.132 hojas, las embebe con Gemini en lotes de 50 y las guarda en
`buscador_arancelario.arancel_embedding`.

- **Es reanudable.** Compara el texto guardado con el actual y solo procesa lo
  que falta o cambió. Si se corta por cuota, se vuelve a correr y sigue.
- **Consume mucha cuota.** Con el plan gratuito entran unas 900 filas por día;
  con una key de pago son unos 10 minutos.

### La guarda de cobertura

La búsqueda semántica **queda desactivada hasta que el índice cubra el 98 %** del
arancel. No es una precaución de más:

> Un índice vectorial a medio poblar es **peor** que no tenerlo. pgvector siempre
> devuelve el vecino más cercano, así que con el 11 % cargado responde con total
> confianza la mejor opción de un subconjunto arbitrario — y puede ser de otro
> capítulo. No hay error ni excepción: solo resultados sutilmente equivocados.

El servicio revisa la cobertura cada 5 minutos, así que **se activa sola** al
terminar el backfill, sin desplegar nada. Mientras esté desactivada lo avisa en
el log.

---

## 5. Cómo funciona en tiempo de ejecución

### 5.1 Una búsqueda manual

```
GET /arancel/subpartidas?q=...
  → SearchSubpartidasUseCase
    → BusquedaHibridaService.buscar()
      → SubpartidaRepository.searchRanked()        [SQL: buscar_subpartidas]
      → ¿resultado flojo?  (score < 1,2 o menos de 5 filas)
          sí → EmbeddingService.embedConsulta()    [API Gemini]
             → BusquedaSemanticaRepository.buscar() [SQL: pgvector]
             → fusión RRF
```

Lo léxico primero y lo semántico solo si hace falta, por costo: lo léxico son
35 ms y cero llamadas a la API; lo semántico agrega ~300 ms y consume cuota.
Gastarla en toda búsqueda —la mayoría de las cuales lo léxico ya resuelve—
sería pagar latencia sin cambiar el resultado.

### 5.2 Una clasificación

```
POST /facturas/:id/clasificar-subpartidas
  → ClasificarSubpartidasUseCase
    1. clasificacion_aprendida   ¿ya lo confirmó una persona?  → listo, sin LLM
    2. clasificacion_cache       ¿ya lo respondió la IA?       → listo, sin LLM
    3. AIService.clasificarSubpartidasBatch()
       a. expansión      1 llamada para todo el lote
       b. candidatos     24 por ítem desde Postgres, sin LLM
       c. rerank         1 llamada por GRUPO de ítems del mismo capítulo
```

Los ítems se agrupan por su capítulo dominante porque las notas legales son la
mayor parte del prompt y son idénticas dentro de un capítulo: mandarlas una vez
por grupo, en vez de una por ítem, bajó el prompt un 40% y las llamadas de 9 a 5
en una factura de 8 ítems. `LLM_ITEMS_POR_LLAMADA=1` vuelve al esquema de una
llamada por ítem, que da más atención por producto y cuesta más.

Para medir el impacto de cualquier cambio en el prompt, sin gastar cuota:

```bash
npm run prompt:medir
```

`force = true` saltea 1 y 2: es la vía para corregir una entrada aprendida que
resultó estar mal, que si no quedaría fijada para siempre.

**Guardarraíl:** el código que devuelve el modelo tiene que estar entre los
candidatos. Los LLM alucinan códigos arancelarios con formato perfecto y eso no
se detecta a ojo; si no está en la lista, se descarta.

### 5.3 Arquitectura del código

Puertos y adaptadores. Los casos de uso dependen de interfaces en
`core/domain/ports/outbound/`, y las implementaciones viven en
`infraestructure/`:

| Puerto | Implementación | Contra qué |
| --- | --- | --- |
| `SubpartidaRepository` | `PgArancelSubpartidaRepository` | `aranceles` |
| `BusquedaSemanticaRepository` | `PgVectorBusquedaSemanticaRepository` | `aranceles` |
| `EmbeddingService` | `GeminiEmbeddingService` | API Gemini |
| `AIService` | `LangChainAIService` | API Gemini |
| `ClasificacionAprendidaRepository` | `TypeOrm...` | `dimsai` |

---

## 6. Mantenimiento

### Recarga anual del arancel

Cuando se cargue el arancel del año siguiente sobre las tablas de origen:

```sql
-- 1. Refrescar la superficie de búsqueda (no bloquea lecturas)
SELECT buscador_arancelario.refrescar_arancel_busqueda();
```

```bash
# 2. Regenerar los embeddings de lo que cambió
npm run embeddings:backfill
```

El backfill compara el texto guardado con el actual, así que solo reprocesa lo
que efectivamente cambió.

Si cambia la **estructura** de las tablas de origen (columnas nuevas), hay que
volver a correr `001` completa: la vista se recrea desde cero.

### Sinónimos

Se editan por SQL; no hay pantalla de administración.

```sql
INSERT INTO buscador_arancelario.sinonimos (termino, expansion, notas)
VALUES ('termino comercial', 'vocabulario del arancel', 'por qué')
ON CONFLICT (termino) DO UPDATE SET expansion = EXCLUDED.expansion;
```

Dos reglas para que sirvan de algo:

1. **La expansión tiene que existir en el arancel.** Verificarlo antes:
   ```sql
   SELECT count(*) FROM buscador_arancelario.arancel_busqueda
   WHERE tsv @@ to_tsquery('buscador_arancelario.es_unaccent', 'palabra');
   ```
2. **Corta y al grano.** Cada palabra de más diluye la métrica de cobertura del
   ranking.

Los cambios toman efecto de inmediato: la expansión se resuelve en cada consulta.

---

## 7. Diagnóstico

```sql
-- ¿Está todo instalado?
SELECT extname FROM pg_extension;                    -- unaccent, pg_trgm, vector
SELECT cfgname FROM pg_ts_config
 WHERE cfgname = 'es_unaccent';                      -- la configuración FTS

-- ¿La configuración FTS funciona? Debe dar 'maquin' 'automat'
SELECT to_tsvector('buscador_arancelario.es_unaccent', 'Máquinas automáticas');

-- Cobertura de embeddings (la semántica se activa al 98 %)
SELECT count(*) AS embebidas,
       round(100.0 * count(*) / 8132, 1) AS pct
FROM buscador_arancelario.arancel_embedding;

-- Ver el plan de una búsqueda; debe rondar los 35 ms
EXPLAIN (ANALYZE)
SELECT * FROM buscador_arancelario.buscar_subpartidas('cafe tostado molido', 40);
```

| Síntoma | Causa probable |
| --- | --- |
| La búsqueda no devuelve nada, para cualquier consulta | Falta `003`, o falló `es_unaccent` |
| `laptop` no encuentra nada pero `computadora` sí | Falta la tabla `sinonimos` o quedó vacía |
| Búsquedas de ~500 ms en vez de ~35 ms | Faltan los índices GIN de `001` |
| La semántica nunca se usa | Cobertura bajo el 98 %, o falta `GEMINI_API_KEY` |
| 429 al clasificar | Cuota de Gemini; bajar `LLM_CONCURRENCIA` o usar key de pago |

### Pruebas

```bash
npm run test:integration
```

27 casos contra las bases reales, con el modelo de IA reemplazado por un doble:
no gastan cuota y se pueden correr siempre. Si faltan las variables de conexión,
las suites se saltean en vez de fallar.

---

## 8. Decisiones y por qué

Las que más sorprenden al leer el SQL, todas medidas sobre esta base:

| Decisión | Motivo |
| --- | --- |
| `UNION` en vez de `OR` entre ramas de búsqueda | Con `OR` el planner no usa ningún índice GIN y cae a seq scan: 574 ms contra 33 ms |
| `ts_rank` y nunca `ts_rank_cd` | 3 µs por fila contra 195 µs; la proximidad no aporta en textos de una línea |
| Recorte a 200 candidatos antes de puntuar | Acota el costo del scoring caro sin perder resultados: el mejor nunca cae fuera del top-200 |
| Un código solo se detecta con 4+ dígitos | Extraer todos los dígitos convertía `MOUSE ... M90` en una búsqueda del capítulo 90 |
| La descripción del capítulo entra con peso C | Aporta contexto sin dominar el ranking |
| Notas legales truncadas por el final | Las exclusiones, que son lo que decide, están al principio |
| Candidatos con diversidad de capítulos | Si todos salen del mismo, el LLM hereda el error del motor léxico sin poder corregirlo |

---

## 9. Limitaciones conocidas

- **No hay ejecutor de migraciones.** Se aplican a mano y en orden.
- **`synchronize: true`** en la base de la app (ver sección 1).
- **Embeddings incompletos**, con la semántica desactivada hasta el 98 %.
- **Sin ABM** de sinónimos ni de clasificaciones aprendidas: una entrada mal
  aprendida hoy solo se corrige con `force` o por SQL.
- **Cuota de Gemini**: 20 solicitudes por minuto en el plan gratuito, y
  clasificar una factura son `1 + N` llamadas.
- **Ranking flojo con consultas largas**: agregar `manga larga` a
  `camisas de algodón para hombre` empeora el resultado, porque esos términos
  matchean pantalones largos.
