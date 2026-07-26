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

// Consignatario / "bill to" de la factura. Es el importador de la DIMS: casi
// toda factura comercial lo trae, así que se extrae en vez de pedirlo a mano.
export interface FacturaImportador {
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombreRazonSocial?: string;
  domicilio?: string;
  departamentoDestino?: string;
  confidence?: number;
}

// Datos de la carga. Salen del packing list o de la guía de transporte, no de
// la factura comercial: por eso la carga admite varios archivos.
export interface FacturaLogistica {
  cantidadBultos?: number;
  pesoBrutoKg?: number;
  pesoNetoKg?: number;
  /** Nº de manifiesto / guía aérea (AWB) / carta de porte. */
  manifiesto?: string;
  /** País desde donde se despachó físicamente la carga. */
  paisUltimaProcedencia?: string;
  /** Código del medio de transporte: 1 marítimo, 3 carretero, 4 aéreo, 5 courier. */
  medioTransporte?: string;
  confidence?: number;
}

export type FacturaDocumentoTipo =
  | 'factura'
  | 'packingList'
  | 'guiaTransporte'
  | 'otro';

export interface FacturaDocumento {
  /** Identificador estable dentro de la factura: sirve para descargarlo. */
  id?: string;
  nombre: string;
  mimeType: string;
  tipo: FacturaDocumentoTipo;
  /** false cuando la IA no pudo sacar nada útil de ese archivo. */
  aporto: boolean;
  /**
   * Por qué no aportó, cuando `aporto` es false. Sin esto el cliente solo ve un
   * documento que "no sirvió" y no puede decirle al usuario si tiene que volver
   * a subirlo, reintentar, o si cargó el archivo equivocado.
   */
  error?: {
    codigo: string;
    mensaje: string;
  };
  /**
   * Nombre del archivo original tal como quedó guardado, relativo a la carpeta
   * de la factura. Se guarda para que el usuario pueda mirar el papel al lado
   * del formulario y verificar lo que la IA leyó; sin eso, revisar un dato
   * extraído obliga a abrir el PDF por fuera.
   *
   * Es solo el nombre, no la ruta completa: este objeto viaja al cliente en la
   * respuesta de la API y la estructura de directorios del servidor no.
   */
  archivo?: string;
  tamanoBytes?: number;
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

// Documentos soporte de la declaración. `acreditaValor` marca los que prueban
// cuánto costó la mercadería: en menor cuantía y no presencial hay que
// presentar al menos uno (Campos requeridos de la DIMS, §1.A).
export interface DocumentoSoporte {
  cod: string;
  label: string;
  acreditaValor: boolean;
}

export const DOCUMENTOS_SOPORTE: DocumentoSoporte[] = [
  { cod: 'CM-003', label: 'Factura comercial del proveedor', acreditaValor: true },
  { cod: 'CM-004', label: 'Factura de compra local', acreditaValor: true },
  { cod: 'CM-007', label: 'Declaración jurada del valor', acreditaValor: true },
  {
    cod: 'OT-001',
    label: 'Comprobante de recepción del depósito',
    acreditaValor: false,
  },
];

export const DOCUMENTOS_QUE_ACREDITAN_VALOR = DOCUMENTOS_SOPORTE.filter(
  (d) => d.acreditaValor,
).map((d) => d.cod);

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
