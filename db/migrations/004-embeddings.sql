-- =============================================================================
-- Fase 5 — búsqueda semántica
--
-- Corre en la base `aranceles`, esquema buscador_arancelario: los vectores son
-- datos del arancel, no de la aplicación. Tenerlos acá permite además cruzarlos
-- con `arancel_busqueda` en una sola consulta, cosa imposible si vivieran en
-- `dimsai` — Postgres no consulta entre bases, aunque estén en la misma
-- instancia Aiven.
--
-- Para qué: medido sobre 18 descripciones de factura reales, la búsqueda
-- léxica acierta el capítulo en el top-1 solo 9 veces, y en 5 casos el capítulo
-- correcto no aparece ni entre 40 candidatos — ahí el LLM no puede corregir
-- nada porque nunca ve la opción buena. "SHAMPOO ANTICASPA" no devuelve nada:
-- el arancel dice "champú". Los sinónimos de la fase 3 tapan casos conocidos
-- uno por uno; los embeddings generalizan a los que nadie anticipó.
--
-- Poblar con:  npm run embeddings:backfill
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS buscador_arancelario.arancel_embedding (
  codigo     text PRIMARY KEY,          -- solo dígitos, cruza con arancel_busqueda.codigo
  capitulo   text NOT NULL,
  -- Texto que se embebió. Se guarda para saber qué regenerar cuando cambie el
  -- arancel: el backfill compara este texto con el actual.
  texto      text NOT NULL,
  embedding  vector(768) NOT NULL,
  modelo     text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arancel_embedding_capitulo
  ON buscador_arancelario.arancel_embedding (capitulo);

-- Índice ANN por coseno. Con 8.132 filas el scan exacto ya es rápido, pero el
-- índice mantiene el costo plano si el arancel crece o si se agregan
-- descripciones alternativas por subpartida.
CREATE INDEX IF NOT EXISTS arancel_embedding_hnsw
  ON buscador_arancelario.arancel_embedding USING hnsw (embedding vector_cosine_ops);

ANALYZE buscador_arancelario.arancel_embedding;

-- -----------------------------------------------------------------------------
-- Nota histórica: esta tabla vivió primero en `dimsai` (public.arancel_embedding),
-- cuando el arancel estaba en otro servidor sin pgvector. Los vectores se
-- copiaron con scripts/mover-embeddings-a-aranceles.ts. La tabla vieja quedó en
-- pie a propósito: regenerar embeddings cuesta cuota de API, así que borrarla
-- es una decisión aparte, para tomar recién con esta verificada en producción.
--
--   DROP TABLE public.arancel_embedding;   -- en dimsai, cuando corresponda
-- -----------------------------------------------------------------------------
