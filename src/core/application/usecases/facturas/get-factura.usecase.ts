import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';

@Injectable()
export class GetFacturaUseCase {
  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
  ) {}

  async execute(id: string): Promise<FacturaEntity> {
    const factura = await this.facturaRepository.findById(id);
    if (!factura) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'La factura solicitada no existe.' },
      });
    }
    return factura;
  }
}
