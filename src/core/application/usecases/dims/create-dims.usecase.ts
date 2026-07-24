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
    // `id` es una referencia interna del borrador, NO el código DIMS oficial:
    // ese lo asigna SUMA al transmitir la declaración (ver submit-dims).
    dims.id = this.generateDraftRef();
    dims.estado = 'borrador';
    dims.modalidad = '4101';
    dims.regimen = '41';
    dims.tipoUsuario = 'general';
    dims.parteRecepcionSiNo = true;
    dims.requiereInfAdicional = false;
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
      // Pre-llenar la información de la transacción con lo que trae la factura.
      const totales = factura.totales ?? {};
      dims.transaccion = {
        valorFobUsd: totales.subtotal ?? 0,
        fleteDeclaradoSiNo: (totales.flete ?? 0) > 0,
        fleteUsd: totales.flete ?? 0,
        seguroDeclaradoSiNo: (totales.seguro ?? 0) > 0,
        seguroUsd: totales.seguro ?? 0,
        cantidadBultos: 1,
        pesoBruto: 0,
        pesoNeto: 0,
      };
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
        clasificada: true,
      };
      dims.items = [item];
      dims.proveedor = '';
    }

    return this.dimsRepository.save(dims);
  }

  // Referencia interna del borrador. Deliberadamente NO tiene formato de código
  // DIMS oficial: ese número lo emite SUMA, no esta plataforma.
  private generateDraftRef(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(10000 + Math.random() * 89999);
    return `BORRADOR-${year}-${seq}`;
  }
}
