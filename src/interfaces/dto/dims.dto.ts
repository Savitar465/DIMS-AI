import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExportFormat, FacturaItem } from '../../core/domain/models/aduana';

const EXPORT_FORMATS: ExportFormat[] = ['xml', 'pdf', 'json', 'print'];

export class CreateDimsDto {
  @ApiPropertyOptional({ example: 'fac_8f21a' })
  @IsOptional()
  @IsString()
  facturaId?: string;

  @ApiPropertyOptional({ example: '8471.30.00.00' })
  @IsOptional()
  @IsString()
  subpartida?: string;
}

export class DimsUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proveedor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aduanaIngreso?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regimen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modalidad?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  items?: FacturaItem[];
}

export class ExportDimsDto {
  @ApiProperty({ enum: EXPORT_FORMATS })
  @IsEnum(EXPORT_FORMATS)
  formato: ExportFormat;
}

export class EmailDimsDto {
  @ApiProperty({ example: 'agente@despachante.bo' })
  @IsEmail()
  destinatario: string;

  @ApiProperty({ enum: EXPORT_FORMATS })
  @IsEnum(EXPORT_FORMATS)
  formato: ExportFormat;
}
