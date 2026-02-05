export class Subpartida {
  id: string;
  codigo: string;
  descripcion: string;
  arancel: number; // Porcentaje de arancel aplicable
  linea: 'negra' | 'blanca' | 'electronica' | 'otra';

  constructor(partial: Partial<Subpartida>) {
    Object.assign(this, partial);
  }
}
