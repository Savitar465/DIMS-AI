import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger } from 'nestjs-pino/InjectPinoLogger';
import { PinoLogger } from 'nestjs-pino/PinoLogger';
import { EventoDesactivadoEvent } from '../../../domain/events/evento/evento-desactivado.event';

@EventsHandler(EventoDesactivadoEvent)
export class EventoDesactivadoHandler implements IEventHandler<EventoDesactivadoEvent> {

    constructor(
      @InjectPinoLogger(EventoDesactivadoHandler.name)
      private readonly logger: PinoLogger
    ) {
    }

    async handle(event: EventoDesactivadoEvent) {
        this.logger.info({ data: event.getData() }, 'Evento desactivado');
    }
}