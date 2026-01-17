import { DomainEvent } from "../../../shared/domain-event";
import { Sala } from "../../models/sala";

export class SalaCreadoEvent extends DomainEvent<Sala> {

    public static readonly EVENT_NAME = 'sala-creado'

    constructor(sala: Sala) {
        super(sala);
    }

    getName() {
        return SalaCreadoEvent.EVENT_NAME;
    }
}