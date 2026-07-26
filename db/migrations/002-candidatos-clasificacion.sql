-- =============================================================================
-- Fase 2 — soporte de base para el rerank con LLM
--
-- Dos funciones que no necesita un buscador para humanos pero sí el LLM:
-- candidatos con diversidad de capítulos, y las notas legales de esos
-- capítulos. Requiere 001-buscador-arancelario.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Candidatos para el rerank. Se diferencia de buscar_subpartidas en:
--
--   1. Diversidad de capítulos. Si las 40 filas salen todas del mismo capítulo,
--      el LLM hereda el error del motor léxico y no tiene con qué corregirlo.
--      El error de capítulo es el más caro de la clasificación arancelaria.
--
--   2. Hermanos. La RGI 6 obliga a comparar solo entre subpartidas del mismo
--      nivel: si entra 8471.60.20 tiene que entrar también 8471.60.90 ("Las
--      demás"), o el LLM no puede aplicar la regla y elige por parecido de texto.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION buscador_arancelario.candidatos_clasificacion(
  p_q             text,
  p_limit         int DEFAULT 40,
  p_max_capitulos int DEFAULT 4,
  p_por_capitulo  int DEFAULT 12,
  p_top_hermanos  int DEFAULT 3
)
RETURNS TABLE (
  codigo_fmt text, capitulo text, subpartida6 text, desc_capitulo text,
  ruta_legible text, desc_hoja text, desc_minimas text, unidad text,
  ga numeric, iva numeric, prohibida text, score real, es_hermano boolean
)
LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $fn$
  WITH base AS (
    SELECT * FROM buscador_arancelario.buscar_subpartidas(p_q, 250)
  ),
  caps AS (
    SELECT b.capitulo FROM base b
    GROUP BY b.capitulo ORDER BY max(b.score) DESC LIMIT p_max_capitulos
  ),
  por_cap AS (
    SELECT b.codigo, b.score,
           row_number() OVER (PARTITION BY b.capitulo ORDER BY b.score DESC) AS rn
    FROM base b JOIN caps c ON c.capitulo = b.capitulo
  ),
  sel AS (
    SELECT codigo, score FROM por_cap WHERE rn <= p_por_capitulo
  ),
  top_n AS (
    SELECT b.subpartida6, b.score FROM base b ORDER BY b.score DESC LIMIT p_top_hermanos
  ),
  herm AS (
    -- Puntaje apenas por debajo del hermano que los arrastró, para que queden
    -- contiguos en el listado y no dispersos.
    SELECT a.codigo, max(t.score) - 0.001 AS score
    FROM top_n t
    JOIN buscador_arancelario.arancel_busqueda a ON a.subpartida6 = t.subpartida6
    GROUP BY a.codigo
  ),
  unidos AS (
    SELECT codigo, max(score) AS score, bool_and(hermano) AS es_hermano FROM (
      SELECT codigo, score, false AS hermano FROM sel
      UNION ALL
      SELECT codigo, score, true  AS hermano FROM herm
    ) u GROUP BY codigo
  )
  SELECT a.codigo_fmt, a.capitulo, a.subpartida6, a.desc_capitulo,
         a.ruta_legible, a.desc_hoja, a.desc_minimas, a.unidad,
         a.ga, a.iva, a.prohibida, u.score, u.es_hermano
  FROM unidos u
  JOIN buscador_arancelario.arancel_busqueda a ON a.codigo = u.codigo
  ORDER BY u.score DESC, a.nc_order
  LIMIT greatest(p_limit, 1);
$fn$;

-- -----------------------------------------------------------------------------
-- Notas legales de los capítulos presentes en los candidatos: son las que
-- permiten aplicar la RGI 1 y las exclusiones ("este Capítulo no comprende...").
--
-- Van truncadas por el final a propósito: las exclusiones, que es lo que decide
-- la clasificación, están al principio de la nota. Sin tope un solo capítulo
-- puede aportar 17.500 caracteres (~4.400 tokens) al prompt.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION buscador_arancelario.notas_para_prompt(
  p_caps          text[],
  p_max_chars_cap int DEFAULT 3500,
  p_max_chars_sec int DEFAULT 2500
)
RETURNS TABLE (tipo text, clave text, titulo text, nota text)
LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $fn$
  WITH n AS (
    SELECT DISTINCT ON (t.capitulo)
           t.capitulo, t.descripcion_capitulo, t.nota_capitulo,
           t.seccion, t.descripcion_seccion, t.nota_seccion
    FROM buscador_arancelario."Notas Tecnicas" t
    WHERE t.capitulo = ANY(p_caps)
    ORDER BY t.capitulo, t.nc_order
  )
  SELECT 'capitulo', n.capitulo, n.descripcion_capitulo,
         CASE WHEN length(n.nota_capitulo) > p_max_chars_cap
              THEN left(n.nota_capitulo, p_max_chars_cap) || E'\n[...nota truncada]'
              ELSE n.nota_capitulo END
  FROM n WHERE nullif(trim(coalesce(n.nota_capitulo,'')), '') IS NOT NULL
  UNION ALL
  -- Una sola vez por sección: varios capítulos comparten la misma nota.
  SELECT 'seccion', s.seccion, s.descripcion_seccion,
         CASE WHEN length(s.nota_seccion) > p_max_chars_sec
              THEN left(s.nota_seccion, p_max_chars_sec) || E'\n[...nota truncada]'
              ELSE s.nota_seccion END
  FROM (
    SELECT DISTINCT ON (n.seccion) n.seccion, n.descripcion_seccion, n.nota_seccion
    FROM n WHERE nullif(trim(coalesce(n.nota_seccion,'')), '') IS NOT NULL
    ORDER BY n.seccion
  ) s;
$fn$;
