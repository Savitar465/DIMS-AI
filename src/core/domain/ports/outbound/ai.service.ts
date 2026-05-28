import { Factura } from '../../models/factura';

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

export interface AIService {
  extraerDatosFactura(
    fileBuffer: Buffer,
    mimeType: string,
    debug?: boolean,
  ): Promise<Partial<Factura> & { debug?: any }>;
  // Clasifica subpartidas para un lote de ítems en UNA sola llamada de IA (texto, sin imagen)
  clasificarSubpartidasBatch(
    items: ClasificacionItemInput[],
  ): Promise<ClasificacionItemOutput[]>;
}

export const AI_SERVICE = 'AI_SERVICE';
