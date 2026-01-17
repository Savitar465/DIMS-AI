import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { SalaService } from '../../../domain/services/sala.service';
import { ModificarSalaRequest } from '../../../../interfaces/dtos/request/sala/modificar-sala.request';
import { SalaResponse } from '../../../../interfaces/dtos/response/sala.response';
import { SalaMapper } from '../../../../interfaces/shared/mapper/sala.mapper';

@Injectable()
export class ModificarSalaUsecase {
  constructor(
    @Inject(ConstantsService.SALA_SERVICE)
    private readonly salaService: SalaService,
  ) {
  }

  async execute(modificarSalaRequest: ModificarSalaRequest): Promise<SalaResponse> {
    const sala = await this.salaService.update(modificarSalaRequest);
    return await SalaMapper.toResponse(sala);
  }
}