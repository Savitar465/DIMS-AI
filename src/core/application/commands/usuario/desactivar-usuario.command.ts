import { DesactivarUsuarioRequest } from '../../../../interfaces/dtos/request/usuario/desactivar-usuario.request';

export class DesactivarUsuarioCommand {
    constructor( public readonly desactivarUsuarioRequest: DesactivarUsuarioRequest) {
    }
}