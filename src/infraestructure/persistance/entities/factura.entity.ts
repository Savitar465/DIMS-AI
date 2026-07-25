import { Column, Entity, PrimaryColumn } from 'typeorm';
import {
  FacturaCabecera,
  FacturaDocumento,
  FacturaEstado,
  FacturaImportador,
  FacturaItem,
  FacturaLogistica,
  FacturaProveedor,
  FacturaTotales,
} from '../../../core/domain/models/aduana';

@Entity('facturas')
export class FacturaEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text', { default: 'procesando' })
  estado: FacturaEstado;

  @Column('simple-json', { nullable: true })
  proveedor: FacturaProveedor;

  @Column('simple-json', { nullable: true })
  factura: FacturaCabecera;

  @Column('simple-json', { nullable: true })
  items: FacturaItem[];

  @Column('simple-json', { nullable: true })
  totales: FacturaTotales;

  // Consignatario extraído del documento: alimenta el importador de la DIMS.
  @Column('simple-json', { nullable: true })
  importador: FacturaImportador;

  // Bultos, pesos y guía de transporte. Suelen venir del packing list o del AWB.
  @Column('simple-json', { nullable: true })
  logistica: FacturaLogistica;

  // Qué archivos se cargaron y cuáles aportaron datos.
  @Column('simple-json', { nullable: true })
  documentos: FacturaDocumento[];

  // Confianza por campo (0–100), indexada por la ruta del campo dentro de la
  // factura: "proveedor.nombre", "logistica.pesoBrutoKg". Sale de cuántos
  // documentos declararon el dato y de si coincidieron entre sí.
  @Column('simple-json', { nullable: true })
  confianzas: Record<string, number>;
}
