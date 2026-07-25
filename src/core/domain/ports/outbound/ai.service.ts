export interface ClasificacionItemInput {
  id: string;
  descripcion: string;
}

export interface ClasificacionItemOutput {
  id: string;
  subpartida: string | null;
  confidence: number;
  razon?: string;
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
  debug?: any;
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
