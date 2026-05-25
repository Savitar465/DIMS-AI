import { Column, Entity, PrimaryColumn } from 'typeorm';
import {
  FacturaCabecera,
  FacturaEstado,
  FacturaItem,
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
}
