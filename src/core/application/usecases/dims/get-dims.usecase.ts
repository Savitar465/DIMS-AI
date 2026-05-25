import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';

@Injectable()
export class GetDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
  ) {}

  async execute(id: string): Promise<DimsEntity> {
    const dims = await this.dimsRepository.findById(id);
    if (!dims) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'La DIMS solicitada no existe.' },
      });
    }
    return dims;
  }
}
