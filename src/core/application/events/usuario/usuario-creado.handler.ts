import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { UsuarioCreadoEvent } from "src/core/domain/events/usuario/usuario-creado.event";

@EventsHandler(UsuarioCreadoEvent)
export class UsuarioCreadoHandler implements IEventHandler<UsuarioCreadoEvent> {

    async handle(event: UsuarioCreadoEvent) {
        console.log('Usuario creado: ', event.getData());
    }
} 