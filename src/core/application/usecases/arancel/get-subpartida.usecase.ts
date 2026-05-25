import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { Subpartida } from '../../../domain/models/subpartida';

@Injectable()
export class GetSubpartidaUseCase {
  constructor(
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
  ) {}

  async execute(code: string): Promise<Subpartida> {
    const sub = await this.subpartidaRepository.findByCode(code);
    if (!sub) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'La subpartida solicitada no existe.' },
      });
    }
    return sub;
  }
}
