import {
  DimsEstado,
  DimsImportador,
  DimsTransaccion,
  FacturaItem,
  Liquidacion,
  TipoUsuarioDims,
  ValidationResult,
} from './aduana';

export class Dims {
  // Referencia interna del borrador. NO es el código DIMS oficial.
  id: string;
  // Código/número oficial de la DIMS. Lo asigna SUMA al transmitir la
  // declaración; permanece indefinido mientras la DIMS está en borrador.
  codigoDims?: string;
  estado: DimsEstado;
  facturaId?: string;
  proveedor: string;
  fecha: string;
  nit?: string;
  aduanaIngreso?: string;
  regimen?: string;
  modalidad?: string;

  // ── Campos requeridos de la DIMS ──
  tipoUsuario?: TipoUsuarioDims;
  importador?: DimsImportador;
  departamentoDestino?: string;
  paisUltimaProcedencia?: string;
  parteRecepcionSiNo?: boolean;
  parteRecepcion?: string;
  transporteHastaFrontera?: string;
  // Nº de manifiesto de carga / guía de transporte.
  manifiesto?: string;
  transaccion?: DimsTransaccion;
  requiereInfAdicional?: boolean;
  infAdicional?: string;
  /** Códigos de los documentos soporte a adjuntar (CM-003, CM-004, OT-001…). */
  documentosSoporte?: string[];

  items: FacturaItem[];
  /**
   * Origen de cada campo (`documento` | `sugerido` | `usuario`), indexado por
   * el id del campo en el formulario. Distingue un dato que alguien revisó de
   * uno que sigue siendo una suposición del sistema.
   */
  origenes?: Record<string, string>;
  /**
   * Qué tan seguro es cada valor leído de un documento (0–100), indexado por el
   * mismo id de campo que `origenes`. Es por campo y no por bloque: con un
   * número por sección lo único que se le puede decir al usuario es "revisá
   * todo esto", que es tanto como no decirle nada.
   */
  confianzas?: Record<string, number>;
  liquidacion?: Liquidacion;
  validacion?: ValidationResult;
  creadaEn?: string;
  actualizadaEn?: string;

  constructor(partial: Partial<Dims>) {
    Object.assign(this, partial);
  }
}

export interface DimsResumen {
  id: string;
  proveedor: string;
  fecha: string;
  valor: number;
  estado: DimsEstado;
}
