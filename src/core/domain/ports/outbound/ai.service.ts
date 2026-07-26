export interface ClasificacionItemInput {
  id: string;
  descripcion: string;
}

export interface ClasificacionAlternativa {
  subpartida: string;
  porQueNo: string;
}

export interface ClasificacionItemOutput {
  id: string;
  subpartida: string | null;
  /** 0–100. */
  confidence: number;
  razon?: string;
  /** RGI invocadas por el modelo, p. ej. "RGI 1 y 6". */
  reglaAplicada?: string;
  /** Las que quedaron cerca, con el motivo del descarte. */
  alternativas?: ClasificacionAlternativa[];
  /**
   * Qué faltó saber del producto para decidir (material, uso, potencia...).
   * Con esto la UI puede preguntar en vez de aceptar una confianza baja.
   */
  datosFaltantes?: string[];
  /** Texto enriquecido con el que se buscaron los candidatos. Para depurar. */
  descripcionExpandida?: string;
}

/**
 * Por qué no se pudo leer un documento. Se distinguen porque la acción del
 * usuario es distinta en cada caso: un PDF escaneado hay que volver a subirlo
 * como imagen, un fallo del modelo se reintenta, y un documento que la IA leyó
 * pero no reconoció como comercial probablemente esté mal cargado.
 */
export type ExtraccionErrorCodigo =
  /** El archivo no tiene texto legible (PDF escaneado sin OCR, archivo vacío). */
  | 'documento_ilegible'
  /** La IA no respondió: error de red, cuota agotada, bloqueo por seguridad. */
  | 'ia_sin_respuesta'
  /** Respondió, pero no se pudo interpretar como el JSON pedido. */
  | 'respuesta_ilegible'
  /** Leyó el documento pero no reconoció ningún dato aprovechable. */
  | 'sin_datos'
  /** Cualquier otro fallo al procesar el archivo. */
  | 'error_interno';

export interface ExtraccionError {
  codigo: ExtraccionErrorCodigo;
  /** Mensaje en español, apto para mostrarle al usuario. */
  mensaje: string;
  /** Motivo técnico, para el log y el soporte. No es para la UI. */
  detalle?: string;
}

export interface ExtraccionProducto {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  valorTotal: number;
}

/**
 * Lo que la IA logra sacar de UN documento. Todo es opcional salvo la
 * intención de leerlo: un packing list o una guía de transporte no traen
 * proveedor ni precios, pero sí pesos, bultos y nº de guía — y esos son
 * justamente los campos de la DIMS que hoy el usuario tipea a mano.
 *
 * Un campo que no aparece en el documento se devuelve `null`, nunca inventado:
 * un dato falso en una declaración aduanera es peor que un campo vacío.
 */
export interface ExtraccionFactura {
  tipoDocumento?: 'factura' | 'packingList' | 'guiaTransporte' | 'otro' | null;
  proveedor?: {
    nombre?: string | null;
    direccion?: string | null;
    pais?: string | null;
    rfc?: string | null;
  } | null;
  factura?: {
    numero?: string | null;
    fecha?: string | null;
    moneda?: string | null;
    incoterm?: string | null;
    puertoEmbarque?: string | null;
  } | null;
  /** Consignatario / "bill to" / "ship to": es el importador de la DIMS. */
  importador?: {
    nombreRazonSocial?: string | null;
    numeroDocumento?: string | null;
    domicilio?: string | null;
    ciudad?: string | null;
  } | null;
  logistica?: {
    cantidadBultos?: number | null;
    pesoBrutoKg?: number | null;
    pesoNetoKg?: number | null;
    manifiesto?: string | null;
    paisUltimaProcedencia?: string | null;
    /** 1 marítimo · 3 carretero · 4 aéreo · 5 postal o courier. */
    medioTransporte?: string | null;
  } | null;
  totales?: {
    subtotal?: number | null;
    flete?: number | null;
    seguro?: number | null;
  } | null;
  productos?: ExtraccionProducto[] | null;
  /**
   * Por qué la lectura no se pudo hacer. Ausente cuando salió bien. Va acá y no
   * como excepción porque un documento ilegible entre varios no invalida la
   * carga: el resto se procesa igual y el usuario tiene que poder ver cuál
   * falló y por qué.
   */
  error?: ExtraccionError;
  debug?: any;
}

/**
 * ¿La lectura trajo al menos un dato utilizable para la DIMS? Vive acá, junto
 * al contrato, porque la usan los dos lados: el adaptador para marcar el error
 * `sin_datos` y el caso de uso para decidir si el documento aportó algo.
 */
export function extraccionAportoDatos(e: ExtraccionFactura): boolean {
  return Boolean(
    e.proveedor?.nombre ||
      e.factura?.numero ||
      e.importador?.nombreRazonSocial ||
      e.logistica?.pesoBrutoKg ||
      e.logistica?.cantidadBultos ||
      e.logistica?.manifiesto ||
      (e.productos?.length ?? 0) > 0,
  );
}

export interface AIService {
  extraerDatosFactura(
    fileBuffer: Buffer,
    mimeType: string,
    debug?: boolean,
  ): Promise<ExtraccionFactura>;
  // Clasifica subpartidas para un lote de ítems en UNA sola llamada de IA (texto, sin imagen)
  clasificarSubpartidasBatch(
    items: ClasificacionItemInput[],
  ): Promise<ClasificacionItemOutput[]>;
}

export const AI_SERVICE = 'AI_SERVICE';
