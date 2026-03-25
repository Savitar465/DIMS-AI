import { Factura } from '../../models/factura';

export interface AIService {
  buscarSubpartidas(descripcion: string, contexto?: any): Promise<any[]>;
  extraerDatosFactura(fileBuffer: Buffer, mimeType: string, debug?: boolean): Promise<Partial<Factura> & { debug?: any }>;
  // Clasifica los productos de una factura (envío único: imagen o PDF) y devuelve los productos con su subpartida
  clasificarProductosDesdeFactura(fileBuffer: Buffer, mimeType: string, debug?: boolean): Promise<any>;
}

export const AI_SERVICE = 'AI_SERVICE';
