import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { SalaCreadoEvent } from "src/core/domain/events/sala/sala-creado.event";
import { InjectPinoLogger } from 'nestjs-pino/InjectPinoLogger';
import { PinoLogger } from 'nestjs-pino/PinoLogger';

@EventsHandler(SalaCreadoEvent)
export class SalaCreadoHandler implements IEventHandler<SalaCreadoEvent> {

    constructor(
      @InjectPinoLogger(SalaCreadoHandler.name)
      private readonly logger: PinoLogger
    ) {
    }

    async handle(event: SalaCreadoEvent) {
        this.logger.info({ data: event.getData() }, 'Sala creada');
    }
}