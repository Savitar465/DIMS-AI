import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DimsImportador,
  DimsTransaccion,
  ExportFormat,
  FacturaItem,
  TipoUsuarioDims,
} from '../../core/domain/models/aduana';

const EXPORT_FORMATS: ExportFormat[] = ['xml', 'pdf', 'json', 'print'];
const TIPOS_USUARIO: TipoUsuarioDims[] = [
  'general',
  'noPresencial',
  'menajeDomestico',
];

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

  @ApiPropertyOptional({ description: 'Aduana de despacho.' })
  @IsOptional()
  @IsString()
  aduanaIngreso?: string;

  @ApiPropertyOptional({ description: 'Destino / Régimen aduanero (ej: 41, 91, 93).' })
  @IsOptional()
  @IsString()
  regimen?: string;

  @ApiPropertyOptional({ description: 'Modalidad del régimen (modReg.cod: 4101, 4107, …).' })
  @IsOptional()
  @IsString()
  modalidad?: string;

  @ApiPropertyOptional({
    enum: TIPOS_USUARIO,
    description: 'Modalidad del declarante (tipoUsuarioDims).',
  })
  @IsOptional()
  @IsIn(TIPOS_USUARIO)
  tipoUsuario?: TipoUsuarioDims;

  @ApiPropertyOptional({
    type: Object,
    description: 'Datos del importador: tipoDocumento, numeroDocumento, nombreRazonSocial, domicilio.',
  })
  @IsOptional()
  @IsObject()
  importador?: DimsImportador;

  @ApiPropertyOptional({ description: 'Departamento de destino.' })
  @IsOptional()
  @IsString()
  departamentoDestino?: string;

  @ApiPropertyOptional({ description: 'País de última procedencia (no puede ser Bolivia).' })
  @IsOptional()
  @IsString()
  paisUltimaProcedencia?: string;

  @ApiPropertyOptional({ description: '¿La DIMS tiene Parte de Recepción?' })
  @IsOptional()
  @IsBoolean()
  parteRecepcionSiNo?: boolean;

  @ApiPropertyOptional({ description: 'Número de Parte de Recepción (requerido si parteRecepcionSiNo).' })
  @IsOptional()
  @IsString()
  parteRecepcion?: string;

  @ApiPropertyOptional({ description: 'Modalidad de transporte hasta la frontera (tra.hasFro).' })
  @IsOptional()
  @IsString()
  transporteHastaFrontera?: string;

  @ApiPropertyOptional({
    description: 'Nº de manifiesto de carga / guía de transporte (AWB, B/L, carta de porte).',
  })
  @IsOptional()
  @IsString()
  manifiesto?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Información de la transacción: valorFobUsd, flete, seguro, bultos y pesos.',
  })
  @IsOptional()
  @IsObject()
  transaccion?: DimsTransaccion;

  @ApiPropertyOptional({ description: '¿Requiere información adicional (docSop.reqInfAdi)?' })
  @IsOptional()
  @IsBoolean()
  requiereInfAdicional?: boolean;

  @ApiPropertyOptional({ description: 'Información adicional (requerida si requiereInfAdicional).' })
  @IsOptional()
  @IsString()
  infAdicional?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['CM-003', 'OT-001'],
    description:
      'Códigos de los documentos soporte que se van a adjuntar. En no ' +
      'presencial hay que incluir al menos uno que acredite el valor ' +
      '(CM-003, CM-004 o CM-007).',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentosSoporte?: string[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  items?: FacturaItem[];

  @ApiPropertyOptional({
    type: Object,
    description:
      'Origen de cada campo (documento | sugerido | usuario). Distingue lo que ' +
      'el usuario ya revisó de lo que sigue siendo una suposición del sistema.',
  })
  @IsOptional()
  @IsObject()
  origenes?: Record<string, string>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Confianza de la extracción por campo (0–100), con las mismas claves ' +
      'que `origenes`. La calcula el servidor al crear la DIMS; se acepta en ' +
      'el update para que el cliente pueda bajarla si el usuario corrige algo.',
  })
  @IsOptional()
  @IsObject()
  confianzas?: Record<string, number>;
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
