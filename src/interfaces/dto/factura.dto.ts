import {
  IsBoolean,
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
  FacturaImportador,
  FacturaLogistica,
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

  @ApiPropertyOptional({
    type: Object,
    description:
      'Consignatario extraído del documento: nombreRazonSocial, numeroDocumento, domicilio, departamentoDestino.',
  })
  @IsOptional()
  @IsObject()
  importador?: FacturaImportador;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Datos de la carga: cantidadBultos, pesoBrutoKg, pesoNetoKg, manifiesto, paisUltimaProcedencia, medioTransporte.',
  })
  @IsOptional()
  @IsObject()
  logistica?: FacturaLogistica;
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

  @ApiPropertyOptional({
    description:
      'true si la persona eligió el código a mano. Solo lo manda la acción explícita, nunca el autoguardado: con esta marca se registra la clasificación como aprendida.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  subpartidaConfirmada?: boolean;
}

export class UploadFacturaDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description:
      'Factura comercial y, opcionalmente, packing list y guía de transporte.',
  })
  archivos: any[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Contrato anterior de un solo archivo. Sigue funcionando.',
  })
  archivo?: any;
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
