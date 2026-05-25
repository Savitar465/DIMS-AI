import {
  DimsEstado,
  FacturaItem,
  Liquidacion,
  ValidationResult,
} from './aduana';

export class Dims {
  id: string;
  estado: DimsEstado;
  facturaId?: string;
  proveedor: string;
  fecha: string;
  nit?: string;
  aduanaIngreso?: string;
  regimen?: string;
  modalidad?: string;
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
