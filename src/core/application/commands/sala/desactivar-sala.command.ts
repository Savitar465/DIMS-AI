import { DesactivarSalaRequest } from '../../../../interfaces/dtos/request/sala/desactivar-sala.request';

export class DesactivarSalaCommand {
    constructor( public readonly desactivarSalaRequest: DesactivarSalaRequest) {
    }
}