import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from 'class-validator';

export class CrearSalaRequest {

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    usuAudit: string;

    @ApiProperty()
    @IsNotEmpty()
    usuarios: string[];
}