-- =============================================================================
-- Fase 3 — puente de vocabulario comercial ↔ arancelario
--
-- Medido sobre esta base: de 33 términos comerciales corrientes, 16 NO existen
-- en el Arancel 2026 (laptop, notebook, mouse, ratón, polera, remera, chompa,
-- suéter, zapatilla, heladera, nevera, calamina, garrafa, fierro, pendrive,
-- refresco). Para esos, la búsqueda léxica no puede devolver nada: no hay
-- ranking que arregle un término que no está en el corpus.
--
-- La expansión por LLM (fase 2) resuelve esto, pero cuesta una llamada y falla
-- con la cuota agotada. Esta tabla lo resuelve en la base, gratis, y sirve
-- también al buscador manual del usuario, que no pasa por el LLM.
--
-- Por qué una tabla y no un diccionario `thesaurus` de Postgres: un thesaurus
-- necesita un archivo en $SHAREDIR/tsearch_data del servidor. No se puede
-- desplegar por SQL y se pierde en cualquier migración de la base. Con una
-- tabla, además, el equipo de comercio exterior puede corregirlo sin DDL.
--
-- Requiere 001-buscador-arancelario.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS buscador_arancelario.sinonimos (
  -- Término tal como lo escribe la gente, sin acentos y en minúsculas. Puede
  -- ser multipalabra ("aire acondicionado"). Se compara con límites de palabra,
  -- así que "fierro" no matchea dentro de otra palabra.
  termino   text PRIMARY KEY,
  -- Texto en vocabulario del arancel que se agrega a la consulta. Corto y al
  -- grano: cada palabra de más diluye la métrica de cobertura del ranking.
  expansion text NOT NULL,
  activo    boolean NOT NULL DEFAULT true,
  notas     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE buscador_arancelario.sinonimos IS
  'Puente entre el vocabulario comercial de las facturas y el legal del arancel. Ver 003-sinonimos.sql.';

-- -----------------------------------------------------------------------------
-- Agrega a la consulta la expansión de cada sinónimo que aparezca como palabra
-- completa. Con pocos cientos de filas es un scan de milisegundos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION buscador_arancelario.expandir_terminos(p_q text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $fn$
  SELECT coalesce(p_q, '') || coalesce(
    (SELECT ' ' || string_agg(DISTINCT s.expansion, ' ')
       FROM buscador_arancelario.sinonimos s
      WHERE s.activo
        AND unaccent(lower(coalesce(p_q, ''))) ~ ('\m' || s.termino || '\M')),
    '');
$fn$;

-- -----------------------------------------------------------------------------
-- Semilla. Solo términos verificados contra el corpus: la expansión apunta a
-- palabras que SÍ existen en el arancel (se comprobó una por una), porque un
-- sinónimo que expande a vocabulario inexistente no aporta nada.
-- -----------------------------------------------------------------------------
INSERT INTO buscador_arancelario.sinonimos (termino, expansion, notas) VALUES
  -- Informática
  ('laptop',      'maquina automatica para tratamiento o procesamiento de datos portatil', 'no existe en el arancel'),
  ('notebook',    'maquina automatica para tratamiento o procesamiento de datos portatil', 'no existe en el arancel'),
  ('mouse',       'dispositivo por coordenadas x-y unidad de entrada', 'el arancel nunca dice mouse ni raton'),
  ('raton',       'dispositivo por coordenadas x-y unidad de entrada', 'el arancel nunca dice mouse ni raton'),
  ('pendrive',    'dispositivo de almacenamiento permanente de datos semiconductor', 'no existe en el arancel'),
  ('disco duro',  'unidad de almacenamiento de datos', NULL),
  ('smartphone',  'telefono movil celular red inalambrica', NULL),

  -- Electrodomésticos
  ('heladera',    'refrigerador domestico de compresion', 'bolivianismo/rioplatense'),
  ('nevera',      'refrigerador domestico de compresion', NULL),
  ('lavarropas',  'maquina para lavar ropa', NULL),
  ('aire acondicionado', 'maquina para acondicionamiento de aire', NULL),

  -- Textil (mucho bolivianismo)
  ('polera',      'camisetas de punto algodon', 'bolivianismo: t-shirt'),
  ('remera',      'camisetas de punto algodon', NULL),
  ('chompa',      'sueteres puloveres cardigan chalecos de punto', 'bolivianismo: sweater'),
  ('sueter',      'sueteres puloveres cardigan chalecos de punto', NULL),
  ('zapatilla',   'calzado deportivo con suela', 'bolivianismo: zapato deportivo'),
  ('casaca',      'chaquetas cazadoras anoraks', NULL),

  -- Construcción
  ('calamina',    'chapas onduladas de hierro o acero galvanizado cincado para techos', 'bolivianismo: chapa acanalada'),
  ('fierro',      'barras de hierro o acero', 'bolivianismo: hierro de construccion'),
  ('garrafa',     'recipiente para gas licuado butano propano', 'bolivianismo: bombona de gas'),

  -- Alimentos y bebidas
  ('gaseosa',     'bebidas no alcoholicas agua gaseada con adicion de azucar', NULL),
  ('refresco',    'bebidas no alcoholicas agua gaseada con adicion de azucar', NULL),

  -- Automotriz
  ('llanta',      'neumaticos nuevos de caucho', NULL),
  ('bateria',     'acumuladores electricos', NULL),
  ('movilidad',   'vehiculo automovil', 'bolivianismo: vehiculo')
ON CONFLICT (termino) DO UPDATE
  SET expansion = EXCLUDED.expansion,
      notas     = EXCLUDED.notas,
      updated_at = now();

-- -----------------------------------------------------------------------------
-- Reemplaza buscar_subpartidas de 001 para aplicar la expansión.
--
-- La expansión alimenta el FTS y la cobertura, pero NO el trigram ni la
-- detección de código: esos siguen mirando el texto original. Si el trigram
-- comparara contra la consulta expandida, la similitud se desplomaría por
-- longitud y se perdería la tolerancia a errores de tipeo.
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
  v_exp   text;
  v_raw   text;
  v_num   text;
  v_and   tsquery;
  v_or    tsquery;
  v_qarr  text[];
  v_cfg   regconfig := 'buscador_arancelario.es_unaccent'::regconfig;
  v_pre   int := 200;
BEGIN
  v_exp  := buscador_arancelario.expandir_terminos(p_q);
  v_raw  := unaccent(lower(coalesce(p_q, '')));   -- trigram sobre el original
  -- Solo cuenta como código un token que EMPIECE en dígito y tenga 4 o más
  -- (partida completa). Extraer todos los dígitos del texto convertía
  -- "MOUSE OPT USB LOGITECH M90" en una búsqueda del capítulo 90.
  v_num  := regexp_replace(
              coalesce((regexp_match(coalesce(p_q, ''), '\m([0-9]{4}(\.[0-9]{2})*)\M'))[1], ''),
              '[^0-9]', '', 'g');
  v_and  := websearch_to_tsquery(v_cfg, v_exp);
  v_or   := CASE WHEN numnode(v_and) > 0
                 THEN to_tsquery(v_cfg, replace(v_and::text, ' & ', ' | '))
                 END;
  v_qarr := tsvector_to_array(to_tsvector(v_cfg, v_exp));

  IF v_or IS NULL AND length(v_num) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
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
  SELECT b.codigo, b.codigo_fmt, b.capitulo, b.partida, b.subpartida6,
         b.seccion, b.desc_capitulo, b.desc_hoja, b.ruta, b.ruta_legible,
         b.desc_minimas, b.unidad, b.ga, b.iva, b.prohibida,
         (
             pre.r_tsv * 2.0
           + coalesce(ts_rank(b.tsv_hoja, v_or, 32), 0) * 2.5
           + 2.0 * (cardinality(cov.lex)::real / greatest(cardinality(v_qarr), 1))
           + CASE WHEN numnode(v_and) > 0 AND b.tsv @@ v_and THEN 1.5 ELSE 0 END
           + similarity(coalesce(b.desc_hoja, ''), v_raw) * 0.8
           + pre.es_codigo * 20.0
         )::real
  FROM buscador_arancelario.arancel_busqueda b
  JOIN pre ON pre.id = b.id
  CROSS JOIN LATERAL (
    SELECT ARRAY(SELECT unnest(v_qarr) INTERSECT SELECT unnest(tsvector_to_array(b.tsv))) AS lex
  ) cov
  ORDER BY 16 DESC, b.nc_order
  LIMIT greatest(p_limit, 1);
END
$fn$;
