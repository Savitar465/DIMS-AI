import { Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { BuscarSubpartidasUseCase } from 'src/core/application/usecases/dims/buscar-subpartidas.usecase';
import { BuscarSubpartidasDesdePdfUseCase } from 'src/core/application/usecases/dims/buscar-subpartidas-desde-pdf.usecase';
import { DigitalizarFacturaUseCase } from 'src/core/application/usecases/dims/digitalizar-factura.usecase';

@ApiTags('DIMS - Automatización con IA')
@Controller('dims')
export class DimsController {
  constructor(
    private readonly buscarSubpartidasUseCase: BuscarSubpartidasUseCase,
    private readonly buscarSubpartidasDesdePdfUseCase: BuscarSubpartidasDesdePdfUseCase,
    private readonly digitalizarFacturaUseCase: DigitalizarFacturaUseCase,
  ) {}

  @Get('subpartidas')
  @ApiOperation({ summary: 'HU-001: Búsqueda de Subpartidas Arancelarias con IA' })
  async buscarSubpartidas(
    @Query('q') query: string,
    @Query('linea') linea?: string,
  ) {
    try {
      return await this.buscarSubpartidasUseCase.execute(query, linea);
    } catch (err) {
      return { error: 'Error buscando subpartidas', message: (err as Error)?.message };
    }
  }

  @Post('digitalizar-factura')
  @ApiOperation({ summary: 'HU-003: Digitalización de Facturas (PDF/Imagen)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async digitalizarFactura(@UploadedFile() file: Express.Multer.File, @Query('debug') debug?: string) {
    try {
      const debugFlag = debug === 'true';
      return await this.digitalizarFacturaUseCase.execute(file.buffer, file.mimetype, debugFlag);
    } catch (err) {
      return {
        proveedor: 'Error en extracción',
        valorTotal: 0,
        productos: [{ descripcion: (err as Error)?.message || 'No se pudo extraer data', cantidad: 0, valorUnitario: 0, valorTotal: 0 }]
      };
    }
  }

  @Post('digitalizar-factura-imagen')
  @ApiOperation({ summary: 'HU-003b: Digitalización de Facturas (solo imagen)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async digitalizarFacturaImagen(@UploadedFile() file: Express.Multer.File, @Query('debug') debug?: string) {
    try {
      const debugFlag = debug === 'true';
      // Delegate to the same use case; the service will handle OCR for images
      return await this.digitalizarFacturaUseCase.execute(file.buffer, file.mimetype, debugFlag);
    } catch (err) {
      return {
        proveedor: 'Error en extracción',
        valorTotal: 0,
        productos: [{ descripcion: (err as Error)?.message || 'No se pudo extraer data', cantidad: 0, valorUnitario: 0, valorTotal: 0 }]
      };
    }
  }

  @Post('buscar-subpartidas-pdf')
  @ApiOperation({ summary: 'Sugerir subpartidas desde PDF de factura' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async buscarDesdePdf(@UploadedFile() file: Express.Multer.File) {
    try {
      return await this.buscarSubpartidasDesdePdfUseCase.execute(file.buffer, file.mimetype);
    } catch (err) {
      return { error: 'Error procesando PDF', message: (err as Error)?.message };
    }
  }
}
