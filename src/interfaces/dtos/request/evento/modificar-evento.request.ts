import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { Cambio, Mensaje } from '../../../../core/domain/models/evento';

export class ModificarEventoRequest<T> {

    @ApiProperty()
    id: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    usuario: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo: string;

    @ApiProperty()
    @IsNotEmpty()
    data: Mensaje | Cambio;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    sala: string;

    @ApiProperty()
    @IsNotEmpty()
    usuariosMencionados: string[];

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'El usuAudit no puede estar vacío.' })
    usuAudit: string;
}
