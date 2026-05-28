import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadFacturaUseCase } from '../../../core/application/usecases/facturas/upload-factura.usecase';
import { GetFacturaUseCase } from '../../../core/application/usecases/facturas/get-factura.usecase';
import { UpdateFacturaUseCase } from '../../../core/application/usecases/facturas/update-factura.usecase';
import { UpdateFacturaItemUseCase } from '../../../core/application/usecases/facturas/update-factura-item.usecase';
import { ClasificarSubpartidasUseCase } from '../../../core/application/usecases/facturas/clasificar-subpartidas.usecase';
import { AddFacturaItemUseCase } from '../../../core/application/usecases/facturas/add-factura-item.usecase';
import {
  AddFacturaItemDto,
  FacturaUpdateDto,
  UpdateFacturaItemDto,
  UploadFacturaDto,
} from '../../dto/factura.dto';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

@ApiTags('Facturas')
@Controller('facturas')
export class FacturasController {
  constructor(
    private readonly uploadFacturaUseCase: UploadFacturaUseCase,
    private readonly getFacturaUseCase: GetFacturaUseCase,
    private readonly updateFacturaUseCase: UpdateFacturaUseCase,
    private readonly updateFacturaItemUseCase: UpdateFacturaItemUseCase,
    private readonly clasificarSubpartidasUseCase: ClasificarSubpartidasUseCase,
    private readonly addFacturaItemUseCase: AddFacturaItemUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Cargar factura para extracción con IA' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFacturaDto })
  @UseInterceptors(FileInterceptor('archivo'))
  async upload(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo) {
      throw new BadRequestException({
        error: { code: 'bad_request', message: 'Falta el archivo de factura.' },
      });
    }
    if (archivo.size > MAX_SIZE) {
      throw new HttpException(
        {
          error: {
            code: 'payload_too_large',
            message: 'El archivo supera el límite de 10 MB.',
          },
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    if (!ALLOWED_MIMES.includes(archivo.mimetype)) {
      throw new HttpException(
        {
          error: {
            code: 'unsupported_media_type',
            message: 'Tipo de archivo no soportado. Use PDF, JPG o PNG.',
          },
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    return this.uploadFacturaUseCase.execute(archivo.buffer, archivo.mimetype);
  }

  @Get(':facturaId')
  @ApiOperation({ summary: 'Obtener factura y datos extraídos' })
  async getFactura(@Param('facturaId') facturaId: string) {
    return this.getFacturaUseCase.execute(facturaId);
  }

  @Put(':facturaId')
  @ApiOperation({ summary: 'Corregir datos extraídos' })
  async updateFactura(
    @Param('facturaId') facturaId: string,
    @Body() body: FacturaUpdateDto,
  ) {
    return this.updateFacturaUseCase.execute(facturaId, body);
  }

  @Put(':facturaId/items/:itemId')
  @ApiOperation({ summary: 'Asignar/corregir la subpartida de un ítem' })
  async updateItem(
    @Param('facturaId') facturaId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateFacturaItemDto,
  ) {
    return this.updateFacturaItemUseCase.execute(facturaId, itemId, body);
  }

  @Post(':facturaId/clasificar-subpartidas')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Clasificar subpartidas de los ítems de la factura (una sola llamada batch a IA)',
  })
  async clasificarSubpartidas(@Param('facturaId') facturaId: string) {
    return this.clasificarSubpartidasUseCase.execute(facturaId);
  }

  @Post(':facturaId/items')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Agregar un ítem manualmente a la factura',
    description:
      'Crea un ítem nuevo con clasificada=false. La próxima llamada a POST /facturas/:id/clasificar-subpartidas lo procesará en la IA junto con los demás pendientes.',
  })
  async addItem(
    @Param('facturaId') facturaId: string,
    @Body() body: AddFacturaItemDto,
  ) {
    return this.addFacturaItemUseCase.execute(facturaId, body);
  }
}
