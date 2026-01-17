import { DomainEvent } from "../../../shared/domain-event";
import { Usuario } from "../../models/usuario";

export class UsuarioDesactivadoEvent extends DomainEvent<Usuario> {

    public static readonly EVENT_NAME = 'usuario-desactivado'

    constructor(usuario: Usuario) {
        super(usuario);
    }

    getName() {
        return UsuarioDesactivadoEvent.EVENT_NAME;
    }
}