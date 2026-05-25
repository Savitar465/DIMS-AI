import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import { FacturaItem } from '../../../domain/models/aduana';
import { GetDimsUseCase } from './get-dims.usecase';

export interface UpdateDimsInput {
  proveedor?: string;
  nit?: string;
  aduanaIngreso?: string;
  regimen?: string;
  modalidad?: string;
  items?: FacturaItem[];
}

@Injectable()
export class UpdateDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string, input: UpdateDimsInput): Promise<DimsEntity> {
    const dims = await this.getDimsUseCase.execute(id);
    if (dims.estado !== 'borrador') {
      throw new ConflictException({
        error: {
          code: 'conflict',
          message: 'Solo se pueden editar DIMS en estado borrador.',
        },
      });
    }

    if (input.proveedor !== undefined) dims.proveedor = input.proveedor;
    if (input.nit !== undefined) dims.nit = input.nit;
    if (input.aduanaIngreso !== undefined)
      dims.aduanaIngreso = input.aduanaIngreso;
    if (input.regimen !== undefined) dims.regimen = input.regimen;
    if (input.modalidad !== undefined) dims.modalidad = input.modalidad;
    if (input.items !== undefined) dims.items = input.items;

    return this.dimsRepository.save(dims);
  }
}
