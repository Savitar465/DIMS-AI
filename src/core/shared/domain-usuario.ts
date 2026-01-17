import { v4 as uuidv4 } from 'uuid';
import { UsuarioBase } from './usuario-base';

export abstract class DomainUsuario<T> extends UsuarioBase {
    protected constructor(private readonly data: T) {
        super(uuidv4(), new Date())
    }

    getData(): T {
        return this.data
    }
}