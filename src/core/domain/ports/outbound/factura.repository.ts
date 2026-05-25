import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';

export interface FacturaRepository {
  save(factura: FacturaEntity): Promise<FacturaEntity>;
  findById(id: string): Promise<FacturaEntity | null>;
}

export const FACTURA_REPOSITORY = 'FACTURA_REPOSITORY';
