import { DomainEvent } from "../../../shared/domain-event";
import { Sala } from "../../models/sala";

export class SalaDesactivadoEvent extends DomainEvent<Sala> {

    public static readonly EVENT_NAME = 'sala-desactivado'

    constructor(sala: Sala) {
        super(sala);
    }

    getName() {
        return SalaDesactivadoEvent.EVENT_NAME;
    }
}