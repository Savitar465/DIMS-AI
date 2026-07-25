import { Inject, Injectable } from '@nestjs/common';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';
import {
  FacturaCabecera,
  FacturaImportador,
  FacturaLogistica,
  FacturaProveedor,
  FacturaTotales,
} from '../../../domain/models/aduana';
import { GetFacturaUseCase } from './get-factura.usecase';

export interface UpdateFacturaInput {
  proveedor?: FacturaProveedor;
  factura?: FacturaCabecera;
  totales?: FacturaTotales;
  importador?: FacturaImportador;
  logistica?: FacturaLogistica;
}

@Injectable()
export class UpdateFacturaUseCase {
  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    private readonly getFacturaUseCase: GetFacturaUseCase,
  ) {}

  async execute(id: string, input: UpdateFacturaInput): Promise<FacturaEntity> {
    const factura = await this.getFacturaUseCase.execute(id);
    if (input.proveedor) {
      factura.proveedor = { ...factura.proveedor, ...input.proveedor };
    }
    if (input.factura) {
      factura.factura = { ...factura.factura, ...input.factura };
    }
    if (input.totales) {
      factura.totales = { ...factura.totales, ...input.totales };
    }
    if (input.importador) {
      factura.importador = { ...factura.importador, ...input.importador };
    }
    if (input.logistica) {
      factura.logistica = { ...factura.logistica, ...input.logistica };
    }
    return this.facturaRepository.save(factura);
  }
}
