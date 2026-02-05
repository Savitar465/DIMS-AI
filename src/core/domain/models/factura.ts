export class ProductoFactura {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  valorTotal: number;
  codigoSubpartida?: string;
}

export class Factura {
  id: string;
  proveedor: string;
  fecha: string;
  productos: ProductoFactura[];
  valorTotal: number;
  moneda: string;

  constructor(partial: Partial<Factura>) {
    Object.assign(this, partial);
  }
}
