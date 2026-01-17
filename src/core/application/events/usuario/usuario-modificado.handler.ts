import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { UsuarioModificadoEvent } from '../../../domain/events/usuario/usuario-modificado.event';

@EventsHandler(UsuarioModificadoEvent)
export class UsuarioModificadoHandler implements IEventHandler<UsuarioModificadoEvent> {

    async handle(event: UsuarioModificadoEvent) {
        console.log('Usuario modificado: ', event.getData());
    }
} 