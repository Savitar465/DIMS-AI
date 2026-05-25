export type LineaId = 'blanca' | 'negra' | 'electronica';

export class Subpartida {
  code: string;
  desc: string;
  linea: LineaId;
  arancel: number; // Gravamen Arancelario (%)
  iva: number; // IVA efectivo (%)
  ice: number; // ICE (%)
  gravamen: string; // Resumen de carga tributaria

  constructor(partial: Partial<Subpartida>) {
    Object.assign(this, partial);
  }
}

export interface SubpartidaMatch extends Subpartida {
  score: number;
  bestMatch: boolean;
}
