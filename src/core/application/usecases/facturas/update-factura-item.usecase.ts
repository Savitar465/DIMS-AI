import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaItem } from '../../../domain/models/aduana';
import { GetFacturaUseCase } from './get-factura.usecase';

export interface UpdateFacturaItemInput {
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precioUnit?: number;
  subpartida?: string | null;
}

@Injectable()
export class UpdateFacturaItemUseCase {
  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    private readonly getFacturaUseCase: GetFacturaUseCase,
  ) {}

  async execute(
    facturaId: string,
    itemId: string,
    input: UpdateFacturaItemInput,
  ): Promise<FacturaItem> {
    const factura = await this.getFacturaUseCase.execute(facturaId);
    const item = (factura.items || []).find((it) => it.id === itemId);
    if (!item) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'El ítem solicitado no existe.' },
      });
    }

    if (input.descripcion !== undefined) item.descripcion = input.descripcion;
    if (input.cantidad !== undefined) item.cantidad = input.cantidad;
    if (input.unidad !== undefined) item.unidad = input.unidad;
    if (input.precioUnit !== undefined) item.precioUnit = input.precioUnit;
    if (input.subpartida !== undefined) {
      item.subpartida = input.subpartida;
      // La subpartida fue confirmada/corregida por el usuario.
      item.aiSuggested = false;
      item.confidence = 100;
    }
    item.subtotal = (item.cantidad || 0) * (item.precioUnit || 0);

    await this.facturaRepository.save(factura);
    return item;
  }
}
