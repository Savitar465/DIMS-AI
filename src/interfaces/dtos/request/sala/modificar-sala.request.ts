import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ModificarSalaRequest {

    @ApiProperty()
    id: string;

    @ApiProperty()
    @IsNotEmpty()
    usuarios: string[];

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'El usuAudit no puede estar vacío.' })
    usuAudit: string;
}
