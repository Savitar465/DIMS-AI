import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import {
  DimsImportador,
  DimsTransaccion,
  FacturaItem,
  TipoUsuarioDims,
} from '../../../domain/models/aduana';
import { GetDimsUseCase } from './get-dims.usecase';

export interface UpdateDimsInput {
  proveedor?: string;
  nit?: string;
  aduanaIngreso?: string;
  regimen?: string;
  modalidad?: string;
  tipoUsuario?: TipoUsuarioDims;
  importador?: DimsImportador;
  departamentoDestino?: string;
  paisUltimaProcedencia?: string;
  parteRecepcionSiNo?: boolean;
  parteRecepcion?: string;
  transporteHastaFrontera?: string;
  manifiesto?: string;
  transaccion?: DimsTransaccion;
  requiereInfAdicional?: boolean;
  infAdicional?: string;
  documentosSoporte?: string[];
  items?: FacturaItem[];
  origenes?: Record<string, string>;
  confianzas?: Record<string, number>;
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
    if (input.tipoUsuario !== undefined) dims.tipoUsuario = input.tipoUsuario;
    if (input.importador !== undefined) dims.importador = input.importador;
    if (input.departamentoDestino !== undefined)
      dims.departamentoDestino = input.departamentoDestino;
    if (input.paisUltimaProcedencia !== undefined)
      dims.paisUltimaProcedencia = input.paisUltimaProcedencia;
    if (input.parteRecepcionSiNo !== undefined)
      dims.parteRecepcionSiNo = input.parteRecepcionSiNo;
    if (input.parteRecepcion !== undefined)
      dims.parteRecepcion = input.parteRecepcion;
    if (input.transporteHastaFrontera !== undefined)
      dims.transporteHastaFrontera = input.transporteHastaFrontera;
    if (input.manifiesto !== undefined) dims.manifiesto = input.manifiesto;
    if (input.transaccion !== undefined) dims.transaccion = input.transaccion;
    if (input.requiereInfAdicional !== undefined)
      dims.requiereInfAdicional = input.requiereInfAdicional;
    if (input.infAdicional !== undefined) dims.infAdicional = input.infAdicional;
    if (input.documentosSoporte !== undefined)
      dims.documentosSoporte = input.documentosSoporte;
    if (input.items !== undefined) dims.items = input.items;
    if (input.origenes !== undefined) dims.origenes = input.origenes;
    if (input.confianzas !== undefined) dims.confianzas = input.confianzas;

    return this.dimsRepository.save(dims);
  }
}
