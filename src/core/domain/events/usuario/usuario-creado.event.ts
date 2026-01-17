import { DomainEvent } from "../../../shared/domain-event";
import { Usuario } from "../../models/usuario";

export class UsuarioCreadoEvent extends DomainEvent<Usuario> {

    public static readonly EVENT_NAME = 'usuario-creado'

    constructor(usuario: Usuario) {
        super(usuario);
    }

    getName() {
        return UsuarioCreadoEvent.EVENT_NAME;
    }
}