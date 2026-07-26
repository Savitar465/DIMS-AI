import { Injectable } from '@nestjs/common';
import { SubpartidaMatch } from '../../../domain/models/subpartida';
import { BusquedaHibridaService } from '../../services/busqueda-hibrida.service';

export interface SearchSubpartidasResult {
  query: string;
  resultados: SubpartidaMatch[];
}

const MAX_RESULTS = 20;

@Injectable()
export class SearchSubpartidasUseCase {
  constructor(private readonly busqueda: BusquedaHibridaService) {}

  /**
   * El ranking (tokenización, stopwords, stemming español, tolerancia a
   * acentos y a tipeo) vive en Postgres. Antes se tokenizaba acá y se hacía
   * una consulta por token, sumando 1 punto por token que matcheara: eso no
   * distingue un match en el texto legal de la subpartida de uno en la glosa
   * heredada del capítulo, que es justo la diferencia que importa.
   *
   * Cuando lo léxico no encuentra nada convincente, el servicio híbrido
   * completa con búsqueda semántica.
   *
   * `linea` se acepta por compatibilidad del contrato HTTP pero ya no filtra:
   * el Arancel 2026 no tiene ese campo.
   */
  async execute(
    query: string,
    _linea?: string,
  ): Promise<SearchSubpartidasResult> {
    const q = (query ?? '').trim();
    if (!q) return { query: q, resultados: [] };

    const resultados = await this.busqueda.buscar(q, MAX_RESULTS);
    return { query: q, resultados };
  }
}
