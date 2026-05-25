import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import { FacturaItem } from '../../../domain/models/aduana';

export interface CreateDimsInput {
  facturaId?: string;
  subpartida?: string;
}

@Injectable()
export class CreateDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
  ) {}

  async execute(input: CreateDimsInput): Promise<DimsEntity> {
    if (!input?.facturaId && !input?.subpartida) {
      throw new BadRequestException({
        error: {
          code: 'bad_request',
          message: 'Debe indicar facturaId o subpartida para crear la DIMS.',
        },
      });
    }

    const dims = new DimsEntity();
    dims.id = this.generateId();
    dims.estado = 'borrador';
    dims.modalidad = 'SIMPLIFICADA';
    dims.regimen = 'IM4';
    dims.fecha = new Date().toISOString().slice(0, 10);
    dims.items = [];

    if (input.facturaId) {
      const factura = await this.facturaRepository.findById(input.facturaId);
      if (!factura) {
        throw new BadRequestException({
          error: {
            code: 'bad_request',
            message: 'La factura indicada no existe.',
          },
        });
      }
      dims.facturaId = factura.id;
      dims.proveedor = factura.proveedor?.nombre ?? '';
      if (factura.factura?.fecha) dims.fecha = factura.factura.fecha;
      dims.items = (factura.items || []).map((it) => ({ ...it }));
    } else if (input.subpartida) {
      const sub = await this.subpartidaRepository.findByCode(input.subpartida);
      const item: FacturaItem = {
        id: 'i1',
        descripcion: sub?.desc ?? '',
        cantidad: 0,
        unidad: 'UND',
        precioUnit: 0,
        subtotal: 0,
        subpartida: input.subpartida,
        confidence: 100,
        aiSuggested: false,
      };
      dims.items = [item];
      dims.proveedor = '';
    }

    return this.dimsRepository.save(dims);
  }

  private generateId(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(10000 + Math.random() * 89999);
    return `DIMS-${year}-${seq}`;
  }
}
