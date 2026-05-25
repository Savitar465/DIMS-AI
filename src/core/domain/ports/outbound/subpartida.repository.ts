import { LineaId, Subpartida } from '../../models/subpartida';

export interface SubpartidaRepository {
  search(termino: string, linea?: string): Promise<Subpartida[]>;
  findAll(): Promise<Subpartida[]>;
  findByCode(code: string): Promise<Subpartida | null>;
  findByLinea(linea: LineaId): Promise<Subpartida[]>;
}

export const SUBPARTIDA_REPOSITORY = 'SUBPARTIDA_REPOSITORY';
