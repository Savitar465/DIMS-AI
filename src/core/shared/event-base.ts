export abstract class EventBase {

    protected constructor(readonly eventId: string, readonly ocurredOn: Date) { }

    abstract getName(): string;

}
