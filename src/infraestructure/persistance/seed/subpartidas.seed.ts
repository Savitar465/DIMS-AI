import { LineaId } from '../../../core/domain/models/subpartida';

export interface SubpartidaSeed {
  code: string;
  desc: string;
  linea: LineaId;
  arancel: number;
  iva: number;
  ice: number;
  gravamen: string;
}

export const SUBPARTIDAS_SEED: SubpartidaSeed[] = [
  {
    code: '8471.30.00.00',
    desc: 'Máquinas automáticas para tratamiento de datos, portátiles, peso ≤ 10 kg (laptops)',
    linea: 'electronica',
    arancel: 5,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 5%',
  },
  {
    code: '8471.41.00.00',
    desc: 'Máquinas automáticas para tratamiento de datos de escritorio',
    linea: 'electronica',
    arancel: 5,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 5%',
  },
  {
    code: '8517.13.00.00',
    desc: 'Teléfonos inteligentes (smartphones)',
    linea: 'electronica',
    arancel: 0,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 0%',
  },
  {
    code: '8528.72.00.00',
    desc: 'Aparatos receptores de televisión, en color (LED / LCD)',
    linea: 'electronica',
    arancel: 15,
    iva: 14.94,
    ice: 5,
    gravamen: 'GA 15% · ICE 5%',
  },
  {
    code: '8418.10.00.00',
    desc: 'Combinaciones de refrigerador y congelador con puertas exteriores separadas',
    linea: 'blanca',
    arancel: 15,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 15%',
  },
  {
    code: '8418.40.00.00',
    desc: 'Congeladores horizontales del tipo arca, de capacidad ≤ 800 L',
    linea: 'blanca',
    arancel: 20,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 20%',
  },
  {
    code: '8450.11.00.00',
    desc: 'Máquinas de lavar ropa, totalmente automáticas, capacidad ≤ 10 kg',
    linea: 'blanca',
    arancel: 20,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 20%',
  },
  {
    code: '8516.60.00.00',
    desc: 'Hornos eléctricos; cocinas, calentadores, parrillas y asadores',
    linea: 'blanca',
    arancel: 20,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 20%',
  },
  {
    code: '8516.50.00.00',
    desc: 'Hornos de microondas',
    linea: 'blanca',
    arancel: 20,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 20%',
  },
  {
    code: '9403.40.00.00',
    desc: 'Muebles de madera del tipo de los utilizados en cocinas',
    linea: 'negra',
    arancel: 15,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 15%',
  },
  {
    code: '9403.30.00.00',
    desc: 'Muebles de madera del tipo de los utilizados en oficinas',
    linea: 'negra',
    arancel: 15,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 15%',
  },
  {
    code: '9401.61.00.00',
    desc: 'Asientos con relleno tapizado, con armazón de madera',
    linea: 'negra',
    arancel: 15,
    iva: 14.94,
    ice: 0,
    gravamen: 'GA 15%',
  },
];
