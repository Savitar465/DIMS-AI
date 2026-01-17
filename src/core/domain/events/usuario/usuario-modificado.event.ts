import { DomainEvent } from "../../../shared/domain-event";
import { Usuario } from "../../models/usuario";

export class UsuarioModificadoEvent extends DomainEvent<Usuario> {

    public static readonly EVENT_NAME = 'usuario-modificado'

    constructor(usuario: Usuario) {
        super(usuario);
    }

    getName() {
        return UsuarioModificadoEvent.EVENT_NAME;
    }
}