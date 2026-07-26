-- =============================================================================
-- Repone la nota legal del capítulo 07 en la base `aranceles`.
--
-- Al migrar de savi a Aiven, "Notas Tecnicas" quedó con 97 de 98 capítulos:
-- falta el 07 (hortalizas, plantas, raíces y tubérculos alimenticios). Sin esa
-- nota, cualquier ítem que caiga en el capítulo 07 se clasifica sin sus
-- exclusiones legales — y la nota 1 justamente excluye los productos
-- forrajeros de la partida 12.14, que es una confusión frecuente.
--
-- Contenido recuperado de la base anterior antes de darla de baja.
-- =============================================================================

INSERT INTO buscador_arancelario."Notas Tecnicas"
  (id, nc_order, capitulo, descripcion_capitulo, seccion,
   nota_capitulo, descripcion_seccion, nota_seccion)
SELECT
  7, 7, '07',
  'HORTALIZAS, PLANTAS, RAICES Y TUBERCULOS ALIMENTICIOS',
  'II',
  E'**Notas.**\n\n```\n1. Este Capítulo no comprende los productos forrajeros de la partida 12.14.\n2. En las partidas 07.09, 07.10, 07.11 y 07.12, la expresión hortalizas alcanza también a los hongos comestibles, trufas, aceitunas, alcaparras, calabacines (zapallitos), calabazas (zapallos), berenjenas, maíz dulce (Zea mays var. saccharata), frutos de los géneros Capsicum o Pimenta, hinojo y plantas como el perejil, perifollo, estragón, berro y mejorana cultivada (Majorana hortensis u Origanum majorana).\n3. La partida 07.12 comprende todas las hortalizas secas de las especies clasificadas en las partidas 07.01 a 07.11, excepto:\n  a) las hortalizas de vaina secas desvainadas (partida 07.13);\n  b) el maíz dulce en las formas especificadas en las partidas 11.02 a 11.04;\n  c) la harina, sémola, polvo, copos, gránulos y «pellets», de papa (patata) (partida 11.05);\n  d) la harina, sémola y polvo de hortalizas de vaina secas de la partida 07.13 (partida 11.06).\n4. Los frutos de los géneros Capsicum o Pimenta, secos, triturados o pulverizados, se excluyen, de este Capítulo (partida 09.04).\n5. La partida 07.11 comprende las hortalizas que se hayan sometido a un tratamiento con el único fin de que sean conservadas provisionalmente durante el transporte y almacenamiento antes de su utilización (por ejemplo: con gas sulfuroso o con agua salada, sulfurosa o adicionada de otras sustancias para asegurar provisionalmente dicha conservación), siempre que, en este estado, sean impropias para consumo inmediato.\n```',
  'PRODUCTOS DEL REINO VEGETAL',
  E'Nota.\n1.- En esta Seccion el termino "pellets" designa los productos en forma de cilindro, bolita, etc., aglomerados por simple presion o con adicion de un aglutinante en proporcion inferior o igual al 3% en peso.\n'
WHERE NOT EXISTS (
  SELECT 1 FROM buscador_arancelario."Notas Tecnicas" WHERE capitulo = '07'
);
