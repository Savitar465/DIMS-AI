import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { UsuarioDesactivadoEvent } from '../../../domain/events/usuario/usuario-desactivado.event';

@EventsHandler(UsuarioDesactivadoEvent)
export class UsuarioDesactivadoHandler implements IEventHandler<UsuarioDesactivadoEvent> {

    async handle(event: UsuarioDesactivadoEvent) {
        console.log('Usuario desactivado: ', event.getData());
    }
} 