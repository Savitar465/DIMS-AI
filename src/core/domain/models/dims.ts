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
  transaccion?: DimsTransaccion;
  requiereInfAdicional?: boolean;
  infAdicional?: string;

  items: FacturaItem[];
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
