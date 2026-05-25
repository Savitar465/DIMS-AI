import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DimsEstado,
  FacturaItem,
  Liquidacion,
  ValidationResult,
} from '../../../core/domain/models/aduana';

@Entity('dims')
export class DimsEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text', { default: 'borrador' })
  estado: DimsEstado;

  @Column('text', { nullable: true })
  facturaId: string;

  @Column('text', { nullable: true })
  proveedor: string;

  @Column('text', { nullable: true })
  fecha: string;

  @Column('text', { nullable: true })
  nit: string;

  @Column('text', { nullable: true })
  aduanaIngreso: string;

  @Column('text', { nullable: true })
  regimen: string;

  @Column('text', { nullable: true })
  modalidad: string;

  @Column('simple-json', { nullable: true })
  items: FacturaItem[];

  @Column('simple-json', { nullable: true })
  liquidacion: Liquidacion;

  @Column('simple-json', { nullable: true })
  validacion: ValidationResult;

  @CreateDateColumn()
  creadaEn: Date;

  @UpdateDateColumn()
  actualizadaEn: Date;
}
