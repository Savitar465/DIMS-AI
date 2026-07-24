import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import { GetDimsUseCase } from './get-dims.usecase';

@Injectable()
export class SubmitDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string): Promise<DimsEntity> {
    const dims = await this.getDimsUseCase.execute(id);

    if (dims.estado !== 'borrador') {
      throw new ConflictException({
        error: {
          code: 'conflict',
          message: `La DIMS está en estado "${dims.estado}" y no puede transmitirse.`,
        },
      });
    }

    if (!dims.validacion || !dims.validacion.valido) {
      throw new ConflictException({
        error: {
          code: 'conflict',
          message:
            'La DIMS debe estar validada sin errores antes de transmitirla a SUMA.',
        },
      });
    }

    // El código/número oficial de la DIMS lo asigna SUMA como respuesta a la
    // transmisión; esta plataforma no lo genera. Aquí se simula esa respuesta y
    // se persiste el valor devuelto por SUMA. Si ya viniera asignado, se respeta.
    dims.estado = 'enviada';
    if (!dims.codigoDims) {
      dims.codigoDims = this.simularCodigoSuma();
    }
    return this.dimsRepository.save(dims);
  }

  // Placeholder de integración: representa el número que SUMA retorna al aceptar
  // la DIMS. Reemplazar por la respuesta real del servicio de SUMA.
  private simularCodigoSuma(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(10000 + Math.random() * 89999);
    return `DIMS-${year}-${seq}`;
  }
}
