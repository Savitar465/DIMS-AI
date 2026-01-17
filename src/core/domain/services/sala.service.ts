import { ConstantsRepository } from '../../../interfaces/dependency-injection/constants/constants';
import { Inject, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Sala } from '../models/sala';
import { SalaRepository } from '../ports/outbound/sala.repository';
import { FindSalaQuery } from 'src/core/application/query/sala/find-sala.query';
import { DesactivarSalaRequest } from '../../../interfaces/dtos/request/sala/desactivar-sala.request';
import { SalaModificadoEvent } from '../events/sala/sala-modificado.event';
import { SalaDesactivadoEvent } from '../events/sala/sala-desactivado.event';
import { EstadoEnum } from '../../shared/enums/estado.enum';
import { CrearSalaRequest } from '../../../interfaces/dtos/request/sala/crear-sala.request';
import { ModificarSalaRequest } from '../../../interfaces/dtos/request/sala/modificar-sala.request';
import { FindSalaSearch } from '../../application/query/sala/find-sala-search.query';

@Injectable()
export class SalaService {
  constructor(
    @Inject(ConstantsRepository.SALA_REPOSITORY)
    private readonly salaRepository: SalaRepository,
    private readonly salaEventBus: EventBus,
  ) {
  }

  async save(crearSalaRequest: CrearSalaRequest) {
    return Sala.create({
      usuarios: crearSalaRequest.usuarios,
      usuAudit: crearSalaRequest.usuAudit,
    }).then(async (salaC) => {
      const salaE = await this.salaRepository.save(salaC);
      if (salaE) {
        this.salaEventBus.publish(salaE);
      }
      return Sala.fromEntity(salaE);
    });
  }

  async findById(query: FindSalaQuery) {
    const salaE = await this.salaRepository.findById(query.id);
    return Sala.fromEntity(salaE);
  }

  async search(query: FindSalaSearch) {
    return await this.salaRepository.searchByCriteria(query.criteria);
  }

  async update(modificarSalaRequest: ModificarSalaRequest): Promise<Sala> {
    const salaU = await Sala.create({
      id: modificarSalaRequest.id,
      usuarios: modificarSalaRequest.usuarios,
      usuAudit: modificarSalaRequest.usuAudit,
    });
    const salaE = await this.salaRepository.update(salaU);
    const sala = Sala.fromEntity(salaE);
    if (salaE) {
      this.salaEventBus.publish(new SalaModificadoEvent(sala));
    }
    return sala;
  }

  async deactivate(desactivarSalaRequest: DesactivarSalaRequest) {
    const sala = await Sala.create({
      id: desactivarSalaRequest.id,
      usuAudit: desactivarSalaRequest.usuAudit,
      estado: EstadoEnum.INACTIVO,
    });
    const salaSavedEntity = await this.salaRepository.update(sala);
    const salaSaved = Sala.fromEntity(salaSavedEntity);

    if (salaSaved) {
      this.salaEventBus.publish(new SalaDesactivadoEvent(salaSaved));
    }
    return salaSaved;
  }
}