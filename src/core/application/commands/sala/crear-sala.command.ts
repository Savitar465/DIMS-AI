import { CrearSalaRequest } from "src/interfaces/dtos/request/sala/crear-sala.request";

export class CrearSalaCommand {
    constructor(public readonly crearSalaRequest: CrearSalaRequest) {
    }
}