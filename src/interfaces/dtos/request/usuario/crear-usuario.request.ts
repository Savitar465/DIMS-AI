import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class CrearUsuarioRequest {
    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'El nombre de usuario no puede estar vacío.' })
    username: string;

    @ApiProperty()
    @IsEmail({}, { message: 'El email debe ser un email válido.' })
    @IsNotEmpty({ message: 'El email no puede estar vacío.' })
    email: string;

    @ApiProperty()
    @IsNotEmpty({message: 'La contraseña no puede estar vacía.'})
    password: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'El usuAudit no puede estar vacío.' })
    usuAudit: string;
}