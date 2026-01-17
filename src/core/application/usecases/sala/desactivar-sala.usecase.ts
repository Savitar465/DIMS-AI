import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { SalaService } from '../../../domain/services/sala.service';
import { SalaResponse } from '../../../../interfaces/dtos/response/sala.response';
import { SalaMapper } from '../../../../interfaces/shared/mapper/sala.mapper';
import { DesactivarSalaRequest } from '../../../../interfaces/dtos/request/sala/desactivar-sala.request';

@Injectable()
export class DesactivarSalaUsecase {
    constructor(
        @Inject(ConstantsService.SALA_SERVICE)
        private readonly salaService: SalaService
    ) {
    }

    async execute(desactivarSalaRequest: DesactivarSalaRequest): Promise<SalaResponse> {
        const sala = await this.salaService.deactivate(desactivarSalaRequest);
        return await SalaMapper.toResponse(sala);
    }
}