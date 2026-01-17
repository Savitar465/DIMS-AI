import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { SalaModificadoEvent } from '../../../domain/events/sala/sala-modificado.event';
import { InjectPinoLogger } from 'nestjs-pino/InjectPinoLogger';
import { PinoLogger } from 'nestjs-pino/PinoLogger';

@EventsHandler(SalaModificadoEvent)
export class SalaModificadoHandler implements IEventHandler<SalaModificadoEvent> {

    constructor(
      @InjectPinoLogger(SalaModificadoHandler.name)
      private readonly logger: PinoLogger
    ) {
    }

    async handle(event: SalaModificadoEvent) {
        this.logger.info({ data: event.getData() }, 'Sala modificado');
    }
}