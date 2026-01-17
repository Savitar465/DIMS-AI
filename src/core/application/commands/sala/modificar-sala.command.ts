import { ModificarSalaRequest } from '../../../../interfaces/dtos/request/sala/modificar-sala.request';

export class ModificarSalaCommand {
    constructor( public readonly modificarSalaRequest: ModificarSalaRequest) {
    }
}