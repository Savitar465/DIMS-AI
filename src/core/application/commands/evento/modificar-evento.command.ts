import { ModificarEventoRequest } from '../../../../interfaces/dtos/request/evento/modificar-evento.request';
import { Cambio, Mensaje } from '../../../domain/models/evento';

export class ModificarEventoCommand {
    constructor( public readonly modificarEventoRequest: ModificarEventoRequest<Mensaje | Cambio>) {
    }
}