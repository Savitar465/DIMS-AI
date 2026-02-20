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
    return this.buscarSubpartidasUseCase.execute(query, linea);
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
  async digitalizarFactura(@UploadedFile() file: Express.Multer.File) {
    return this.digitalizarFacturaUseCase.execute(file.buffer, file.mimetype);
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
    return this.buscarSubpartidasDesdePdfUseCase.execute(file.buffer, file.mimetype);
  }
}
