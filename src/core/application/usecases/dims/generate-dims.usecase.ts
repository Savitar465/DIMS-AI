import { Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import { Liquidacion } from '../../../domain/models/aduana';
import { GetDimsUseCase } from './get-dims.usecase';

const IVA_EFECTIVO = 0.1494;

@Injectable()
export class GenerateDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string): Promise<DimsEntity> {
    const dims = await this.getDimsUseCase.execute(id);

    let cif = 0;
    let ga = 0;
    let ice = 0;

    for (const item of dims.items || []) {
      const subtotal = item.subtotal || 0;
      cif += subtotal;
      if (item.subpartida) {
        const sub = await this.subpartidaRepository.findByCode(item.subpartida);
        if (sub) {
          ga += subtotal * (sub.arancel / 100);
          ice += subtotal * (sub.ice / 100);
        }
      }
    }

    const iva = (cif + ga) * IVA_EFECTIVO;
    const totalBob = cif + ga + iva + ice;

    const liquidacion: Liquidacion = {
      cif: round(cif),
      ga: round(ga),
      iva: round(iva),
      ice: round(ice),
      totalBob: round(totalBob),
    };

    dims.liquidacion = liquidacion;
    return this.dimsRepository.save(dims);
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
