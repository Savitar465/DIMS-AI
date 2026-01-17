import { DomainEvent } from "../../../shared/domain-event";
import { Cambio, Evento, Mensaje } from '../../models/evento';

export class EventoModificadoEvent extends DomainEvent<Evento<Mensaje | Cambio>> {

    public static readonly EVENT_NAME = 'evento-modificado'

    constructor(evento: Evento<Mensaje | Cambio>) {
        super(evento);
    }

    getName() {
        return EventoModificadoEvent.EVENT_NAME;
    }
}