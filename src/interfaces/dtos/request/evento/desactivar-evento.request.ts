import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class DesactivarEventoRequest {

    @ApiProperty()
    id: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'El usuAudit no puede estar vacío.' })
    usuAudit: string;
}
