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

  @Column('text', { nullable: true })
  manifiesto: string;

  @Column('simple-json', { nullable: true })
  transaccion: DimsTransaccion;

  @Column('boolean', { nullable: true })
  requiereInfAdicional: boolean;

  @Column('text', { nullable: true })
  infAdicional: string;

  // Códigos de los documentos soporte que se van a adjuntar (CM-003, OT-001…).
  // Es un dato de la declaración, no del archivo cargado: el usuario puede
  // comprometerse a presentar un papel que todavía no subió.
  @Column('simple-json', { nullable: true })
  documentosSoporte: string[];

  @Column('simple-json', { nullable: true })
  items: FacturaItem[];

  // De dónde salió cada campo: leído de un documento, deducido por una regla o
  // puesto/confirmado por el usuario. Se guarda porque al reabrir el borrador
  // hay que saber qué ya revisó una persona y qué sigue siendo una suposición.
  @Column('simple-json', { nullable: true })
  origenes: Record<string, string>;

  // Confianza de la extracción por campo (0–100), con las mismas claves que
  // `origenes`. Permite señalar los tres datos que conviene revisar en vez de
  // pintar una sección entera como dudosa.
  @Column('simple-json', { nullable: true })
  confianzas: Record<string, number>;

  @Column('simple-json', { nullable: true })
  liquidacion: Liquidacion;

  @Column('simple-json', { nullable: true })
  validacion: ValidationResult;

  @CreateDateColumn()
  creadaEn: Date;

  @UpdateDateColumn()
  actualizadaEn: Date;
}
