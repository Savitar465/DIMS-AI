import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaItem } from '../../../domain/models/aduana';

export interface AddFacturaItemInput {
  descripcion: string;
  cantidad?: number;
  unidad?: string;
  precioUnit?: number;
  subpartida?: string | null;
}

@Injectable()
export class AddFacturaItemUseCase {
  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
  ) {}

  async execute(
    facturaId: string,
    input: AddFacturaItemInput,
  ): Promise<FacturaItem> {
    const factura = await this.facturaRepository.findById(facturaId);
    if (!factura) {
      throw new NotFoundException({
        error: {
          code: 'not_found',
          message: `Factura ${facturaId} no encontrada.`,
        },
      });
    }

    const items = Array.isArray(factura.items) ? factura.items : [];
    const nextNum = this.nextItemNumber(items);
    const cantidad = Number(input.cantidad) || 0;
    const precioUnit = Number(input.precioUnit) || 0;

    const item: FacturaItem = {
      id: `i${nextNum}`,
      descripcion: input.descripcion ?? '',
      cantidad,
      unidad: input.unidad ?? 'UND',
      precioUnit,
      subtotal: +(cantidad * precioUnit).toFixed(2),
      subpartida: input.subpartida ?? null,
      confidence: input.subpartida ? 100 : 0,
      aiSuggested: false,
      // El usuario agregó el ítem a mano. La IA aún no lo evaluó —
      // queda como pendiente para la próxima llamada batch.
      clasificada: false,
    };

    factura.items = [...items, item];
    await this.facturaRepository.save(factura);
    return item;
  }

  private nextItemNumber(items: FacturaItem[]): number {
    let max = 0;
    for (const it of items) {
      const m = /^i(\d+)$/.exec(it.id);
      if (m) {
        const n = Number(m[1]);
        if (n > max) max = n;
      }
    }
    return max + 1;
  }
}
