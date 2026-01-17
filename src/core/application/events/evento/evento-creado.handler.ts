import {EventsHandler, IEventHandler} from "@nestjs/cqrs";
import {EventoCreadoEvent} from "../../../domain/events/evento/evento-creado.event";
import {InjectPinoLogger, PinoLogger} from "nestjs-pino";

@EventsHandler(EventoCreadoEvent)
export class EventoCreadoHandler implements IEventHandler<EventoCreadoEvent> {

    constructor(
        @InjectPinoLogger(EventoCreadoHandler.name)
        private readonly logger: PinoLogger
    ) {
    }

    async handle(event: EventoCreadoEvent) {
        this.logger.info({ data: event.getData() }, 'Evento creado');
    }
} 