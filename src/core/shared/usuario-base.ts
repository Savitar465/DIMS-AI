export abstract class UsuarioBase {
    protected constructor(readonly usuarioId: string, readonly ocurredOn: Date) { }
    abstract getName(): string;
}