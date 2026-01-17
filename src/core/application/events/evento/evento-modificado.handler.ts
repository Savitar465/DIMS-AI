import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger } from 'nestjs-pino/InjectPinoLogger';
import { PinoLogger } from 'nestjs-pino/PinoLogger';
import { EventoModificadoEvent } from '../../../domain/events/evento/evento-modificado.event';

@EventsHandler(EventoModificadoEvent)
export class EventoModificadoHandler implements IEventHandler<EventoModificadoEvent> {

    constructor(
      @InjectPinoLogger(EventoModificadoHandler.name)
      private readonly logger: PinoLogger
    ) {
    }

    async handle(event: EventoModificadoEvent) {
        this.logger.info({ data: event.getData() }, 'Evento modificado');
    }
}