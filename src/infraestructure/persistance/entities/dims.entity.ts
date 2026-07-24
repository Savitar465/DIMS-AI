import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DimsEstado,
  DimsImportador,
  DimsTransaccion,
  FacturaItem,
  Liquidacion,
  TipoUsuarioDims,
  ValidationResult,
} from '../../../core/domain/models/aduana';

@Entity('dims')
export class DimsEntity {
  // Referencia interna del borrador. NO es el código DIMS oficial.
  @PrimaryColumn('text')
  id: string;

  // Código/número oficial asignado por SUMA al transmitir. Null en borrador.
  @Column('text', { nullable: true })
  codigoDims: string;

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

  @Column('text', { nullable: true })
  tipoUsuario: TipoUsuarioDims;

  @Column('simple-json', { nullable: true })
  importador: DimsImportador;

  @Column('text', { nullable: true })
  departamentoDestino: string;

  @Column('text', { nullable: true })
  paisUltimaProcedencia: string;

  @Column('boolean', { nullable: true })
  parteRecepcionSiNo: boolean;

  @Column('text', { nullable: true })
  parteRecepcion: string;

  @Column('text', { nullable: true })
  transporteHastaFrontera: string;

  @Column('simple-json', { nullable: true })
  transaccion: DimsTransaccion;

  @Column('boolean', { nullable: true })
  requiereInfAdicional: boolean;

  @Column('text', { nullable: true })
  infAdicional: string;

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
