import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BusquedaSemanticaRepository,
  HitSemantico,
} from '../../../core/domain/ports/outbound/busqueda-semantica.repository';
import { ARANCEL_DATA_SOURCE } from '../arancel.datasource';

/**
 * Búsqueda por vecino más cercano sobre
 * `buscador_arancelario.arancel_embedding`.
 *
 * Los vectores viven en la misma base que el arancel: son datos del arancel,
 * no de la aplicación, y tenerlos juntos permite cruzarlos con
 * `arancel_busqueda` en una sola consulta cuando haga falta.
 */
@Injectable()
export class PgVectorBusquedaSemanticaRepository
  implements BusquedaSemanticaRepository
{
  constructor(@Inject(ARANCEL_DATA_SOURCE) private readonly ds: DataSource) {}

  async buscar(embedding: number[], limit = 40): Promise<HitSemantico[]> {
    if (!Array.isArray(embedding) || embedding.length === 0) return [];

    // `<=>` es distancia coseno en pgvector: 0 idéntico, 2 opuesto.
    const filas: Array<{ codigo: string; distancia: string }> =
      await this.ds.query(
        `SELECT codigo, (embedding <=> $1::vector) AS distancia
           FROM buscador_arancelario.arancel_embedding
          ORDER BY embedding <=> $1::vector
          LIMIT $2`,
        [JSON.stringify(embedding), limit],
      );

    return filas.map((f) => ({
      codigo: f.codigo,
      similitud: 1 - Number(f.distancia),
    }));
  }

  async contarEmbeddings(): Promise<number> {
    try {
      const [{ n }] = await this.ds.query(
        `SELECT count(*)::int AS n FROM buscador_arancelario.arancel_embedding`,
      );
      return Number(n) || 0;
    } catch {
      // Si la tabla no existe todavía (migración 004 sin correr), la búsqueda
      // semántica simplemente no se usa.
      return 0;
    }
  }
}
