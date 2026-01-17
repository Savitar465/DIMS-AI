import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger } from 'nestjs-pino/InjectPinoLogger';
import { PinoLogger } from 'nestjs-pino/PinoLogger';
import { SalaDesactivadoEvent } from '../../../domain/events/sala/sala-desactivado.event';

@EventsHandler(SalaDesactivadoEvent)
export class SalaDesactivadoHandler implements IEventHandler<SalaDesactivadoEvent> {

    constructor(
      @InjectPinoLogger(SalaDesactivadoHandler.name)
      private readonly logger: PinoLogger
    ) {
    }

    async handle(event: SalaDesactivadoEvent) {
        this.logger.info({ data: event.getData() }, 'Sala desactivado');
    }
}