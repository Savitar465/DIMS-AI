import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { CrearSalaRequest } from 'src/interfaces/dtos/request/sala/crear-sala.request';
import { SalaService } from 'src/core/domain/services/sala.service';
import { SalaMapper } from '../../../../interfaces/shared/mapper/sala.mapper';
import { SalaResponse } from '../../../../interfaces/dtos/response/sala.response';

@Injectable()
export class CrearSalaUsecase {
  constructor(
    @Inject(ConstantsService.SALA_SERVICE)
    private readonly salaService: SalaService,
  ) {
  }

  async execute(crearSalaRequest: CrearSalaRequest): Promise<SalaResponse> {
    const sala = await this.salaService.save(crearSalaRequest);
    return await SalaMapper.toResponse(sala);
  }
}