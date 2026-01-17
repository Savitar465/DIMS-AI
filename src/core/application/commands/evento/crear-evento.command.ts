import {CrearEventoRequest} from "../../../../interfaces/dtos/request/evento/crear-evento.request";

export class CrearEventoCommand<T> {
    
    constructor(public readonly crearEventoRequest: CrearEventoRequest<T>) {
    }
}