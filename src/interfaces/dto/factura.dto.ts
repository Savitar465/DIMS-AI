import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FacturaCabecera,
  FacturaProveedor,
  FacturaTotales,
} from '../../core/domain/models/aduana';

export class FacturaUpdateDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  proveedor?: FacturaProveedor;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  factura?: FacturaCabecera;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  totales?: FacturaTotales;
}

export class UpdateFacturaItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unidad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnit?: number;

  @ApiPropertyOptional({
    description: 'Código de subpartida arancelaria (10 dígitos).',
    example: '8471.30.00.00',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.subpartida !== null)
  @IsString()
  subpartida?: string | null;
}

export class UploadFacturaDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  archivo: any;
}

export class AddFacturaItemDto {
  @ApiProperty()
  @IsString()
  descripcion: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unidad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnit?: number;

  @ApiPropertyOptional({
    description: 'Subpartida inicial (opcional). Si se omite, el ítem queda sin clasificar.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.subpartida !== null)
  @IsString()
  subpartida?: string | null;
}
