import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadFacturaUseCase } from '../../../core/application/usecases/facturas/upload-factura.usecase';
import { ExtraccionFallidaError } from '../../../core/domain/errors/extraccion-fallida.error';
import { GetFacturaUseCase } from '../../../core/application/usecases/facturas/get-factura.usecase';
import { GetFacturaDocumentoUseCase } from '../../../core/application/usecases/facturas/get-factura-documento.usecase';
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

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB por archivo
const MAX_ARCHIVOS = 5;
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
    private readonly getFacturaDocumentoUseCase: GetFacturaDocumentoUseCase,
    private readonly updateFacturaUseCase: UpdateFacturaUseCase,
    private readonly updateFacturaItemUseCase: UpdateFacturaItemUseCase,
    private readonly clasificarSubpartidasUseCase: ClasificarSubpartidasUseCase,
    private readonly addFacturaItemUseCase: AddFacturaItemUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Cargar documentos de importación para extracción con IA',
    description:
      'Acepta la factura comercial y, opcionalmente, el packing list y la guía ' +
      'de transporte (campo `archivos`, hasta 5). Cuantos más documentos se ' +
      'carguen, más campos obligatorios de la DIMS quedan pre-llenados: los ' +
      'pesos, los bultos y el nº de manifiesto casi nunca están en la factura. ' +
      'Se mantiene el campo `archivo` (singular) por compatibilidad.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFacturaDto })
  // AnyFilesInterceptor acepta tanto `archivo` (contrato anterior) como
  // `archivos[]`, sin romper a los clientes que ya suben un solo archivo.
  @UseInterceptors(AnyFilesInterceptor())
  async upload(@UploadedFiles() archivos: Express.Multer.File[]) {
    if (!archivos?.length) {
      throw new BadRequestException({
        error: {
          code: 'bad_request',
          message: 'Falta el archivo de factura.',
        },
      });
    }
    if (archivos.length > MAX_ARCHIVOS) {
      throw new BadRequestException({
        error: {
          code: 'bad_request',
          message: `Se pueden cargar hasta ${MAX_ARCHIVOS} documentos por declaración.`,
        },
      });
    }
    for (const archivo of archivos) {
      if (archivo.size > MAX_SIZE) {
        throw new HttpException(
          {
            error: {
              code: 'payload_too_large',
              message: `El archivo "${archivo.originalname}" supera el límite de 10 MB.`,
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
              message: `El archivo "${archivo.originalname}" no es compatible. Use PDF, JPG o PNG.`,
            },
          },
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        );
      }
    }
    try {
      return await this.uploadFacturaUseCase.execute(
        archivos.map((a) => ({
          buffer: a.buffer,
          mimetype: a.mimetype,
          originalname: a.originalname,
        })),
      );
    } catch (e) {
      // 422 y no 500: el servidor funcionó, lo que no se pudo leer es lo que
      // subió el usuario. `facturaId` viaja porque la factura quedó guardada
      // con sus archivos: desde ahí se puede mirar el original y reintentar.
      if (e instanceof ExtraccionFallidaError) {
        throw new HttpException(
          {
            error: {
              code: 'extraccion_fallida',
              message: e.message,
              details: {
                facturaId: e.facturaId,
                documentos: e.detallePorDocumento,
              },
            },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      throw e;
    }
  }

  @Get(':facturaId')
  @ApiOperation({ summary: 'Obtener factura y datos extraídos' })
  async getFactura(@Param('facturaId') facturaId: string) {
    return this.getFacturaUseCase.execute(facturaId);
  }

  @Get(':facturaId/documentos/:documentoId')
  @ApiOperation({
    summary: 'Descargar un documento original',
    description:
      'Devuelve el archivo tal como se subió, para poder verlo al lado del ' +
      'formulario y contrastar los datos que extrajo la IA.',
  })
  async getDocumento(
    @Param('facturaId') facturaId: string,
    @Param('documentoId') documentoId: string,
    @Res({ passthrough: true }) res: any,
  ): Promise<StreamableFile> {
    const { stream, documento } = await this.getFacturaDocumentoUseCase.execute(
      facturaId,
      documentoId,
    );
    res.set({
      'Content-Type': documento.mimeType,
      // `inline` para que se muestre embebido en vez de forzar una descarga.
      'Content-Disposition': `inline; filename="${encodeURIComponent(documento.nombre)}"`,
    });
    return new StreamableFile(stream);
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
