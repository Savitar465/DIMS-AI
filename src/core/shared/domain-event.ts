import { v4 as uuidv4 } from 'uuid';
import {EventBase} from "./event-base";

export abstract class DomainEvent<T> extends EventBase {

    protected constructor(private readonly data: T) {
        super(uuidv4(), new Date())
    }

    getData(): T {
        return this.data
    }

}