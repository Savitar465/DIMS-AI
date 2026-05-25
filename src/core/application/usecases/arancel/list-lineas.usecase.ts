import { Injectable } from '@nestjs/common';
import { Linea } from '../../../domain/models/aduana';

export const LINEAS: Linea[] = [
  { id: 'blanca', label: 'Línea Blanca', color: 'oklch(0.92 0.01 220)' },
  { id: 'negra', label: 'Línea Negra', color: 'oklch(0.30 0.02 280)' },
  { id: 'electronica', label: 'Electrónica', color: 'oklch(0.65 0.18 250)' },
];

@Injectable()
export class ListLineasUseCase {
  execute(): Linea[] {
    return LINEAS;
  }
}
