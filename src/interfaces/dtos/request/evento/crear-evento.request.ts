import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CrearEventoRequest<T> {

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
  data: T;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sala: string;

  @ApiProperty()
  @IsNotEmpty()
  usuariosMencionados: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  usuAudit: string;
}