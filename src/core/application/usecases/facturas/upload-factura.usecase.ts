import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  AI_SERVICE,
  AIService,
} from '../../../domain/ports/outbound/ai.service';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';
import { FacturaItem } from '../../../domain/models/aduana';

@Injectable()
export class UploadFacturaUseCase {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
  ) {}

  async execute(fileBuffer: Buffer, mimeType: string): Promise<FacturaEntity> {
    const id = `fac_${randomBytes(4).toString('hex')}`;
    const factura = new FacturaEntity();
    factura.id = id;

    try {
      const extracted = await this.aiService.extraerDatosFactura(
        fileBuffer,
        mimeType,
      );

      const productos: any[] = Array.isArray(extracted?.productos)
        ? extracted.productos
        : [];

      const items: FacturaItem[] = productos.map((p, idx) =>
        this.mapItem(p, idx),
      );

      const subtotal = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);

      factura.estado = 'extraida';
      factura.proveedor = {
        nombre: extracted?.proveedor ?? undefined,
        confidence: 90,
      };
      factura.factura = {
        fecha: extracted?.fecha ?? undefined,
        moneda: extracted?.moneda ?? 'USD',
        confidence: 90,
      };
      factura.items = items;
      factura.totales = {
        subtotal,
        flete: 0,
        seguro: 0,
        cif: subtotal,
      };
    } catch (err) {
      factura.estado = 'error';
      factura.proveedor = {};
      factura.factura = {};
      factura.items = [];
      factura.totales = {};
    }

    return this.facturaRepository.save(factura);
  }

  private mapItem(p: any, idx: number): FacturaItem {
    const cantidad = Number(p?.cantidad) || 0;
    const precioUnit = Number(p?.valorUnitario) || 0;
    const subtotal = Number(p?.valorTotal) || cantidad * precioUnit;
    return {
      id: `i${idx + 1}`,
      descripcion: p?.descripcion ?? '',
      cantidad,
      unidad: 'UND',
      precioUnit,
      subtotal,
      subpartida: null,
      confidence: 90,
      aiSuggested: false,
      clasificada: false,
    };
  }
}
