import {DomainEvent} from "../../../shared/domain-event";
import { Cambio, Evento, Mensaje } from '../../models/evento';

export class EventoCreadoEvent extends DomainEvent<Evento<Mensaje|Cambio>> {

    public static readonly EVENT_NAME = 'evento-creado'

    constructor(evento: Evento<Mensaje|Cambio>) {
        super(evento);
    }

    getName() {
        return EventoCreadoEvent.EVENT_NAME;
    }
}