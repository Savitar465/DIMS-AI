import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';

export interface DimsListFilter {
  estado?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface DimsListResult {
  data: DimsEntity[];
  total: number;
}

export interface DimsRepository {
  save(dims: DimsEntity): Promise<DimsEntity>;
  findById(id: string): Promise<DimsEntity | null>;
  list(filter: DimsListFilter): Promise<DimsListResult>;
  findDrafts(): Promise<DimsEntity[]>;
  delete(id: string): Promise<void>;
}

export const DIMS_REPOSITORY = 'DIMS_REPOSITORY';
