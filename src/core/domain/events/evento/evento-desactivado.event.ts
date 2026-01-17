import { DomainEvent } from "../../../shared/domain-event";
import { Cambio, Evento, Mensaje } from '../../models/evento';

export class EventoDesactivadoEvent extends DomainEvent<Evento<Mensaje | Cambio>> {

    public static readonly EVENT_NAME = 'evento-desactivado'

    constructor(evento: Evento<Mensaje | Cambio>) {
        super(evento);
    }

    getName() {
        return EventoDesactivadoEvent.EVENT_NAME;
    }
}