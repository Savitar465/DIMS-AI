-- =============================================================================
-- Fase 1 del buscador arancelario — superficie de búsqueda sobre el Arancel 2026
--
-- Base   : aranceles  (Aiven, la misma instancia que dimsai pero otra base)
-- Esquema: buscador_arancelario
--
-- No toca las tablas de origen ("Arancel Completo 2026", "Notas Tecnicas"):
-- tienen nombres con espacios, 86 columnas y se recargan cada año. Todo lo que
-- necesita la búsqueda vive en una vista materializada aparte.
--
-- Es idempotente: se puede volver a correr tal cual después de recargar el
-- arancel del año siguiente.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;

-- -----------------------------------------------------------------------------
-- Configuración FTS: español + sin acentos.
-- Sin esto "articulo" no encuentra "artículo" y "maquinas" no encuentra
-- "máquinas", que es la mitad del arancel.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config c
    JOIN pg_namespace n ON n.oid = c.cfgnamespace
    WHERE c.cfgname = 'es_unaccent' AND n.nspname = 'buscador_arancelario'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION buscador_arancelario.es_unaccent
      (COPY = pg_catalog.spanish);
    ALTER TEXT SEARCH CONFIGURATION buscador_arancelario.es_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH public.unaccent, pg_catalog.spanish_stem;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Vista materializada: solo las hojas del árbol, con las columnas que usa la
-- búsqueda y los tsvector precalculados. Resultado: 8.132 filas.
--
-- "Hoja" = código que ningún otro código extiende. NO usar los enlaces
-- Padre_Nivel_*: están incompletos en ambos sentidos y dan 8.139 filas, con
-- 16 subpartidas NO declarables coladas (2903.77 tiene 16 descendientes, pero
-- ningún hijo la referencia como padre) y 9 hojas reales de 10 dígitos
-- faltantes. Ofrecer un código no declarable en un buscador de aduana es un
-- error que termina en una DIMS rechazada.
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS buscador_arancelario.arancel_busqueda CASCADE;

CREATE MATERIALIZED VIEW buscador_arancelario.arancel_busqueda AS
WITH src AS (
  SELECT a.*,
         regexp_replace(coalesce(a."Codigo", ''), '[^0-9]', '', 'g') AS cod_num,
         concat_ws(' ', a."Descripciones_Minimas_1", a."Descripciones_Minimas_2",
                        a."Descripciones_Minimas_3", a."Descripciones_Minimas_4",
                        a."Descripciones_Minimas_5", a."Descripciones_Minimas_6") AS dmin
  FROM buscador_arancelario."Arancel Completo 2026" a
  WHERE regexp_replace(coalesce(a."Codigo", ''), '[^0-9]', '', 'g') <> ''
),
codigos AS (SELECT DISTINCT cod_num FROM src),
hojas AS (
  SELECT c.cod_num FROM codigos c
  WHERE NOT EXISTS (
    SELECT 1 FROM codigos o
    WHERE o.cod_num <> c.cod_num AND o.cod_num LIKE c.cod_num || '%'
  )
)
SELECT DISTINCT ON (s.cod_num)
  s.id,
  s."ID_Unico"                          AS id_unico,
  s.cod_num                             AS codigo,      -- solo dígitos, para prefijos
  trim(s."Codigo")                      AS codigo_fmt,  -- con puntos, para mostrar
  left(s.cod_num, 2)                    AS capitulo,
  left(s.cod_num, 4)                    AS partida,
  left(s.cod_num, 6)                    AS subpartida6,
  s."Seccion"                           AS seccion,
  s."Descripcion_Seccion"               AS desc_seccion,
  s."Descripcion_Capitulo"              AS desc_capitulo,
  s."Descripcion_Mercancia"             AS desc_hoja,   -- texto legal, suele ser "- - - Los demás"
  s."Descripcion_Completa_Normalizada"  AS ruta,        -- breadcrumb sin acentos (para buscar)
  -- Breadcrumb con acentos y mayúsculas. Además resuelve los residuales en
  -- lenguaje explícito ("Los que no son 'Radiales' ni los demás de su
  -- categoría"), así que es el campo para mostrar y para el prompt del LLM.
  s."Descripcion_Completa_Normalizada_Original" AS ruta_legible,
  nullif(trim(s.dmin), '')              AS desc_minimas,
  s."Unidad_de_Medida"                  AS unidad,
  s.ga, s.iva,
  s."Mercancia_Prohibida_De_Importacion" AS prohibida,
  s.nc_order,
  -- A = texto propio de la hoja | B = ruta + descripciones mínimas | C = capítulo
  setweight(to_tsvector('buscador_arancelario.es_unaccent', coalesce(s."Descripcion_Mercancia", '')), 'A') ||
  setweight(to_tsvector('buscador_arancelario.es_unaccent', coalesce(s."Descripcion_Completa_Normalizada", '')), 'B') ||
  setweight(to_tsvector('buscador_arancelario.es_unaccent', coalesce(s.dmin, '')), 'B') ||
  setweight(to_tsvector('buscador_arancelario.es_unaccent', coalesce(s."Descripcion_Capitulo", '')), 'C') AS tsv,
  -- Solo el texto propio de la hoja: permite premiar el match directo sobre la
  -- glosa heredada del padre.
  to_tsvector('buscador_arancelario.es_unaccent', coalesce(s."Descripcion_Mercancia", '')) AS tsv_hoja
FROM src s
JOIN hojas h ON h.cod_num = s.cod_num
ORDER BY s.cod_num, s.nc_order;

-- codigo y id únicos: el índice único además habilita REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX arancel_busqueda_codigo_uk ON buscador_arancelario.arancel_busqueda (codigo);
CREATE UNIQUE INDEX arancel_busqueda_id_uk     ON buscador_arancelario.arancel_busqueda (id);
CREATE INDEX arancel_busqueda_tsv_gin      ON buscador_arancelario.arancel_busqueda USING gin (tsv);
CREATE INDEX arancel_busqueda_tsvhoja_gin  ON buscador_arancelario.arancel_busqueda USING gin (tsv_hoja);
CREATE INDEX arancel_busqueda_ruta_trgm    ON buscador_arancelario.arancel_busqueda USING gin (ruta public.gin_trgm_ops);
CREATE INDEX arancel_busqueda_hoja_trgm    ON buscador_arancelario.arancel_busqueda USING gin (desc_hoja public.gin_trgm_ops);
CREATE INDEX arancel_busqueda_codigo_pat   ON buscador_arancelario.arancel_busqueda (codigo text_pattern_ops);
CREATE INDEX arancel_busqueda_capitulo     ON buscador_arancelario.arancel_busqueda (capitulo);
CREATE INDEX arancel_busqueda_partida      ON buscador_arancelario.arancel_busqueda (partida);
CREATE INDEX arancel_busqueda_sub6         ON buscador_arancelario.arancel_busqueda (subpartida6);

ANALYZE buscador_arancelario.arancel_busqueda;

-- -----------------------------------------------------------------------------
-- Búsqueda híbrida: FTS español + trigram + prefijo de código.
--
-- Tres decisiones, todas medidas sobre esta base (8.139 filas):
--
--  1. UNION en lugar de OR para juntar las ramas. Con `tsv @@ q OR ruta % raw`
--     el planner no puede usar ninguno de los dos GIN y cae a seq scan: 574 ms.
--
--  2. ts_rank, NUNCA ts_rank_cd. Medido en este servidor: ts_rank_cd cuesta
--     ~195 us/fila contra ~3 us/fila de ts_rank (65x). La densidad de cobertura
--     que agrega ts_rank_cd no aporta nada en descripciones de una línea.
--
--  3. El código se detecta como token de 4+ dígitos, no extrayendo todos los
--     dígitos del texto (ver comentario en v_num).
--
-- Resultado: 33 ms end-to-end.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION buscador_arancelario.buscar_subpartidas(
  p_q        text,
  p_limit    int  DEFAULT 20,
  p_capitulo text DEFAULT NULL
)
RETURNS TABLE (
  codigo text, codigo_fmt text, capitulo text, partida text, subpartida6 text,
  seccion text, desc_capitulo text, desc_hoja text, ruta text, ruta_legible text,
  desc_minimas text, unidad text, ga numeric, iva numeric, prohibida text, score real
)
LANGUAGE plpgsql STABLE
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_raw   text;
  v_num   text;
  v_and   tsquery;
  v_or    tsquery;
  v_qarr  text[];
  v_cfg   regconfig := 'buscador_arancelario.es_unaccent'::regconfig;
  v_pre   int := 200;   -- tope de candidatos que pasan al scoring completo
BEGIN
  v_raw  := unaccent(lower(coalesce(p_q, '')));
  -- Solo cuenta como código un token que EMPIECE en dígito y tenga 4 o más
  -- (partida completa). Extraer todos los dígitos del texto convertía
  -- "MOUSE OPT USB LOGITECH M90" en una búsqueda del capítulo 90, y el bonus
  -- de +20 llenaba los candidatos con instrumentos de medida. Los números de
  -- modelo y las medidas son lo normal en una descripción de factura.
  v_num  := regexp_replace(
              coalesce((regexp_match(coalesce(p_q, ''), '\m([0-9]{4}(\.[0-9]{2})*)\M'))[1], ''),
              '[^0-9]', '', 'g');
  v_and  := websearch_to_tsquery(v_cfg, coalesce(p_q, ''));
  -- Consulta OR derivada de la AND: recupera aunque no matcheen todos los
  -- términos. El bonus de abajo premia después a los que sí matchean todos.
  v_or   := CASE WHEN numnode(v_and) > 0
                 THEN to_tsquery(v_cfg, replace(v_and::text, ' & ', ' | '))
                 END;
  v_qarr := tsvector_to_array(to_tsvector(v_cfg, coalesce(p_q, '')));

  IF v_or IS NULL AND length(v_num) < 4 THEN
    RETURN;   -- consulta vacía o solo stopwords
  END IF;

  RETURN QUERY
  -- Fase 1 — candidatos por índice, una rama por acceso.
  WITH cand AS (
      SELECT b.id FROM buscador_arancelario.arancel_busqueda b
      WHERE v_or IS NOT NULL AND b.tsv @@ v_or
    UNION
      SELECT b.id FROM buscador_arancelario.arancel_busqueda b
      WHERE length(v_num) >= 4 AND b.codigo LIKE v_num || '%'
    UNION
      SELECT b.id FROM buscador_arancelario.arancel_busqueda b
      WHERE v_or IS NOT NULL AND b.desc_hoja % v_raw
  ),
  -- Fase 2 — recorte barato antes del scoring caro.
  pre AS (
    SELECT b.id,
           coalesce(ts_rank(b.tsv, v_or, 32), 0) AS r_tsv,
           CASE WHEN length(v_num) >= 4 AND b.codigo LIKE v_num || '%'
                THEN 1 ELSE 0 END AS es_codigo
    FROM buscador_arancelario.arancel_busqueda b
    JOIN cand c ON c.id = b.id
    WHERE (p_capitulo IS NULL OR b.capitulo = p_capitulo)
    ORDER BY es_codigo DESC, r_tsv DESC
    LIMIT v_pre
  )
  -- Fase 3 — scoring completo sobre <= 200 filas.
  SELECT b.codigo, b.codigo_fmt, b.capitulo, b.partida, b.subpartida6,
         b.seccion, b.desc_capitulo, b.desc_hoja, b.ruta, b.ruta_legible,
         b.desc_minimas, b.unidad, b.ga, b.iva, b.prohibida,
         (
             pre.r_tsv * 2.0                                                       -- glosa completa (A/B/C)
           + coalesce(ts_rank(b.tsv_hoja, v_or, 32), 0) * 2.5                      -- texto propio de la hoja
           + 2.0 * (cardinality(cov.lex)::real / greatest(cardinality(v_qarr), 1)) -- cobertura de términos
           + CASE WHEN numnode(v_and) > 0 AND b.tsv @@ v_and THEN 1.5 ELSE 0 END   -- matchean todos
           + similarity(coalesce(b.desc_hoja, ''), v_raw) * 0.8                    -- tolerancia a tipeo
           + pre.es_codigo * 20.0                                                  -- por código: gana siempre
         )::real
  FROM buscador_arancelario.arancel_busqueda b
  JOIN pre ON pre.id = b.id
  -- Cobertura: qué fracción de los términos de la consulta aparece en la fila.
  -- Evita que un término raro y aislado ("óptico") arrastre todo el ranking.
  CROSS JOIN LATERAL (
    SELECT ARRAY(SELECT unnest(v_qarr) INTERSECT SELECT unnest(tsvector_to_array(b.tsv))) AS lex
  ) cov
  ORDER BY 16 DESC, b.nc_order
  LIMIT greatest(p_limit, 1);
END
$fn$;

-- Refresco tras recargar el arancel. CONCURRENTLY no bloquea lecturas.
CREATE OR REPLACE FUNCTION buscador_arancelario.refrescar_arancel_busqueda()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY buscador_arancelario.arancel_busqueda;
  ANALYZE buscador_arancelario.arancel_busqueda;
END $$;
