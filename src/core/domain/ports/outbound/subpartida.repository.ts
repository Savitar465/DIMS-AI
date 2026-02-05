import { Subpartida } from '../../models/subpartida';

export interface SubpartidaRepository {
  search(termino: string, linea?: string): Promise<Subpartida[]>;
  findAll(): Promise<Subpartida[]>;
}

export const SUBPARTIDA_REPOSITORY = 'SUBPARTIDA_REPOSITORY';
