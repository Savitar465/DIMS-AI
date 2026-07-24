import { LineaId } from './subpartida';

export type FacturaEstado = 'procesando' | 'extraida' | 'error';
export type DimsEstado = 'borrador' | 'enviada' | 'aprobada';
export type FlowStepId = 'factura' | 'editar' | 'dims' | 'validar' | 'exportar';
export type ExportFormat = 'xml' | 'pdf' | 'json' | 'print';

export interface FacturaProveedor {
  nombre?: string;
  direccion?: string;
  pais?: string;
  rfc?: string;
  confidence?: number;
}

export interface FacturaCabecera {
  numero?: string;
  fecha?: string;
  moneda?: string;
  incoterm?: string;
  puertoEmbarque?: string;
  confidence?: number;
}

export interface FacturaItem {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnit: number;
  subtotal: number;
  subpartida: string | null;
  confidence: number;
  aiSuggested: boolean;
  // true cuando la IA ya evaluó este ítem (haya o no encontrado subpartida).
  // Distingue "evaluado sin match" de "ítem nuevo que aún no se clasificó".
  clasificada: boolean;
  // Justificación textual devuelta por la IA en la última clasificación.
  razon?: string;
}

export interface FacturaTotales {
  subtotal?: number;
  flete?: number;
  seguro?: number;
  cif?: number;
}

export interface Liquidacion {
  cif: number;
  ga: number;
  iva: number;
  ice: number;
  totalBob: number;
}

// ── DIMS: campos requeridos de la declaración ────────────────────────────────
// El código/número oficial de la DIMS NO se genera aquí: lo asigna el sistema
// SUMA de la Aduana Nacional al transmitir la declaración. Internamente la DIMS
// se identifica con una referencia de borrador (`Dims.id`).

// Modalidad del declarante (`tipoUsuarioDims`). Condiciona límites de valor y
// documentos soporte obligatorios.
export type TipoUsuarioDims = 'general' | 'noPresencial' | 'menajeDomestico';

export interface DimsImportador {
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombreRazonSocial?: string;
  domicilio?: string;
}

// Información de la transacción comercial (valores, flete, seguro y bultos).
export interface DimsTransaccion {
  valorFobUsd?: number;
  // El flete/seguro declarado solo es requerido cuando el "SiNo" está en true;
  // de lo contrario se calcula por parametrica.
  fleteDeclaradoSiNo?: boolean;
  fleteUsd?: number;
  seguroDeclaradoSiNo?: boolean;
  seguroUsd?: number;
  cantidadBultos?: number;
  pesoBruto?: number;
  pesoNeto?: number;
}

export interface ValidationIssue {
  nivel: 'error' | 'advertencia' | 'info';
  campo?: string;
  mensaje: string;
}

export interface ValidationResult {
  valido: boolean;
  validadaEn?: string;
  issues: ValidationIssue[];
}

export interface Linea {
  id: LineaId;
  label: string;
  color: string;
}

export interface FlowStep {
  id: FlowStepId;
  n: number;
  title: string;
  short: string;
  detail: string;
  duration: string;
  hu: string;
}

export interface DraftInProgress {
  id: string;
  proveedor: string;
  items: number;
  valor: number;
  actualizada: string;
  stepIdx: number;
  stepScreen: FlowStepId;
  pendiente: string;
}

export interface FlujoData {
  steps: FlowStep[];
  drafts: DraftInProgress[];
}

export interface ExportResult {
  formato: ExportFormat;
  url: string;
  nombreArchivo?: string;
  tamanoBytes?: number;
  expiraEn?: string;
}
