import { DomainEvent } from "../../../shared/domain-event";
import { Sala } from "../../models/sala";

export class SalaModificadoEvent extends DomainEvent<Sala> {

    public static readonly EVENT_NAME = 'sala-modificado'

    constructor(sala: Sala) {
        super(sala);
    }

    getName() {
        return SalaModificadoEvent.EVENT_NAME;
    }
}