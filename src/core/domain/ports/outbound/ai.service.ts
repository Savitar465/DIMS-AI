import { Factura } from '../../models/factura';

export interface AIService {
  buscarSubpartidas(descripcion: string, contexto?: any): Promise<any[]>;
  extraerDatosFactura(fileBuffer: Buffer, mimeType: string): Promise<Partial<Factura>>;
}

export const AI_SERVICE = 'AI_SERVICE';
