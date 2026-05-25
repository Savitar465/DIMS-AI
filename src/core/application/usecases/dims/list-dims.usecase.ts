import { Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { DimsResumen } from '../../../domain/models/dims';

export interface ListDimsInput {
  estado?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListDimsResult {
  data: DimsResumen[];
  pagination: { page: number; pageSize: number; total: number };
}

@Injectable()
export class ListDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
  ) {}

  async execute(input: ListDimsInput): Promise<ListDimsResult> {
    const page = input.page && input.page > 0 ? input.page : 1;
    const pageSize =
      input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 20;

    const { data, total } = await this.dimsRepository.list({
      estado: input.estado,
      q: input.q,
      page,
      pageSize,
    });

    const resumenes: DimsResumen[] = data.map((d) => ({
      id: d.id,
      proveedor: d.proveedor ?? '',
      fecha: d.fecha ?? '',
      valor: d.liquidacion?.cif ?? this.sumItems(d.items),
      estado: d.estado,
    }));

    return { data: resumenes, pagination: { page, pageSize, total } };
  }

  private sumItems(items: any[]): number {
    return (items || []).reduce((acc, it) => acc + (it?.subtotal || 0), 0);
  }
}
