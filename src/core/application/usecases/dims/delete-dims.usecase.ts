import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { GetDimsUseCase } from './get-dims.usecase';

@Injectable()
export class DeleteDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const dims = await this.getDimsUseCase.execute(id);
    if (dims.estado !== 'borrador') {
      throw new ConflictException({
        error: {
          code: 'conflict',
          message: 'Solo se pueden eliminar DIMS en estado borrador.',
        },
      });
    }
    await this.dimsRepository.delete(id);
  }
}
