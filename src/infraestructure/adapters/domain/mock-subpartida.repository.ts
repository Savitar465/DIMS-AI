import { Subpartida } from 'src/core/domain/models/subpartida';
import { SubpartidaRepository } from 'src/core/domain/ports/outbound/subpartida.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MockSubpartidaRepository implements SubpartidaRepository {
  private subpartidas: Subpartida[] = [
    new Subpartida({
      id: '1',
      codigo: '8418.10.00.00',
      descripcion: 'Refrigeradores domésticos de compresión',
      arancel: 15,
      linea: 'blanca',
    }),
    new Subpartida({
      id: '2',
      codigo: '8471.30.00.00',
      descripcion: 'Laptops y computadores portátiles',
      arancel: 0,
      linea: 'electronica',
    }),
    new Subpartida({
      id: '3',
      codigo: '8418.40.00.00',
      descripcion: 'Congeladores horizontales del tipo arca',
      arancel: 20,
      linea: 'blanca',
    }),
    new Subpartida({
      id: '4',
      codigo: '8516.60.00.00',
      descripcion: 'Hornos de microondas',
      arancel: 20,
      linea: 'blanca',
    }),
    new Subpartida({
      id: '5',
      codigo: '8528.72.00.00',
      descripcion: 'Televisores LED / LCD',
      arancel: 25,
      linea: 'electronica',
    }),
    new Subpartida({
        id: '6',
        codigo: '9403.40.00.00',
        descripcion: 'Muebles de cocina (Línea negra/madera)',
        arancel: 15,
        linea: 'negra',
      }),
  ];

  async search(termino: string, linea?: string): Promise<Subpartida[]> {
    let results = this.subpartidas;
    if (termino) {
      const lowerTerm = termino.toLowerCase();
      results = results.filter((s) =>
        s.descripcion.toLowerCase().includes(lowerTerm) || s.codigo.includes(lowerTerm)
      );
    }
    if (linea) {
      results = results.filter((s) => s.linea === linea);
    }
    return results;
  }

  async findAll(): Promise<Subpartida[]> {
    return this.subpartidas;
  }
}
