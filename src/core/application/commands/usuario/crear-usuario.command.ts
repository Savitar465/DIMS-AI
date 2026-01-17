import { CrearUsuarioRequest } from "src/interfaces/dtos/request/usuario/crear-usuario.request";

export class CrearUsuarioCommand {
    constructor(public readonly crearUsuarioRequest: CrearUsuarioRequest) {
    }
}