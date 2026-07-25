import { Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
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
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string): Promise<DimsEntity> {
    const dims = await this.getDimsUseCase.execute(id);
    await this.sincronizarClasificacion(dims);

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

  /**
   * Los ítems de la DIMS son una copia de los de la factura, hecha al crearla.
   * Si después alguien clasifica un producto —desde la edición de la factura o
   * desde la propia pantalla de la DIMS— esa copia queda con la subpartida
   * vieja y la liquidación se calcula sobre un código que ya no es el vigente.
   * Antes de liquidar, la clasificación se vuelve a leer de la factura, que es
   * donde vive.
   */
  private async sincronizarClasificacion(dims: DimsEntity): Promise<void> {
    if (!dims.facturaId || !dims.items?.length) return;
    const factura = await this.facturaRepository.findById(dims.facturaId);
    if (!factura?.items?.length) return;

    const porId = new Map(factura.items.map((it) => [it.id, it]));
    dims.items = dims.items.map((item) => {
      const enFactura = porId.get(item.id);
      if (!enFactura) return item;
      return {
        ...item,
        subpartida: enFactura.subpartida,
        confidence: enFactura.confidence,
        clasificada: enFactura.clasificada,
        razon: enFactura.razon,
      };
    });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
