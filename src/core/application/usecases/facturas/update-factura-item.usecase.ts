import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaItem } from '../../../domain/models/aduana';
import { hashDescripcion } from '../../../domain/models/descripcion-hash';
import {
  CLASIFICACION_APRENDIDA_REPOSITORY,
  ClasificacionAprendidaRepository,
} from '../../../domain/ports/outbound/clasificacion-aprendida.repository';
import { GetFacturaUseCase } from './get-factura.usecase';

export interface UpdateFacturaItemInput {
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precioUnit?: number;
  subpartida?: string | null;
  /**
   * La persona eligió este código a mano (buscador o diálogo de sugerencia).
   * Lo manda solo la acción explícita, nunca el autoguardado: este último
   * reenvía la subpartida de todos los ítems en cada save, y sin esta marca
   * cada sugerencia de la IA que nadie revisó entraría como confirmada.
   */
  subpartidaConfirmada?: boolean;
}

@Injectable()
export class UpdateFacturaItemUseCase {
  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    @Inject(CLASIFICACION_APRENDIDA_REPOSITORY)
    private readonly aprendidaRepository: ClasificacionAprendidaRepository,
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

    const subpartidaPrevia = item.subpartida ?? null;

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

    // Se aprende solo de una elección explícita, o de un cambio real de código
    // (corregir la sugerencia de la IA también es una decisión humana). Un
    // autoguardado que reenvía el mismo valor no dice nada y no cuenta.
    const huboDecision =
      input.subpartidaConfirmada === true ||
      (input.subpartida !== undefined && input.subpartida !== subpartidaPrevia);

    // Va después del save y sin bloquear la respuesta: si falla el registro,
    // el usuario igual guardó su cambio — perder una entrada de aprendizaje no
    // justifica romperle la edición.
    if (input.subpartida && huboDecision) {
      this.aprendidaRepository
        .registrar({
          hash: hashDescripcion(item.descripcion),
          descripcion: item.descripcion,
          subpartida: input.subpartida,
        })
        .catch((err) =>
          console.warn('[Aprendizaje] No se pudo registrar la confirmación:', err),
        );
    }

    return item;
  }
}
