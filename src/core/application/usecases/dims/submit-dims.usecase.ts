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

    dims.estado = 'enviada';
    return this.dimsRepository.save(dims);
  }
}
