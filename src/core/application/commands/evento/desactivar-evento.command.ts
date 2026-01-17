import { DesactivarEventoRequest } from '../../../../interfaces/dtos/request/evento/desactivar-evento.request';

export class DesactivarEventoCommand {
    constructor( public readonly desactivarEventoRequest: DesactivarEventoRequest) {
    }
}