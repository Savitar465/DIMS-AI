import { ModificarUsuarioRequest } from '../../../../interfaces/dtos/request/usuario/modificar-usuario.request';

export class ModificarUsuarioCommand {
    constructor( public readonly modificarUsuarioRequest: ModificarUsuarioRequest) {
    }
}