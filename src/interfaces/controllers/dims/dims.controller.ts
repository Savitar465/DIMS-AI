import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ListDimsUseCase } from '../../../core/application/usecases/dims/list-dims.usecase';
import { CreateDimsUseCase } from '../../../core/application/usecases/dims/create-dims.usecase';
import { GetDimsUseCase } from '../../../core/application/usecases/dims/get-dims.usecase';
import { UpdateDimsUseCase } from '../../../core/application/usecases/dims/update-dims.usecase';
import { DeleteDimsUseCase } from '../../../core/application/usecases/dims/delete-dims.usecase';
import { GenerateDimsUseCase } from '../../../core/application/usecases/dims/generate-dims.usecase';
import { ValidateDimsUseCase } from '../../../core/application/usecases/dims/validate-dims.usecase';
import { ExportDimsUseCase } from '../../../core/application/usecases/dims/export-dims.usecase';
import { EmailDimsUseCase } from '../../../core/application/usecases/dims/email-dims.usecase';
import { SubmitDimsUseCase } from '../../../core/application/usecases/dims/submit-dims.usecase';
import {
  CreateDimsDto,
  DimsUpdateDto,
  EmailDimsDto,
  ExportDimsDto,
} from '../../dto/dims.dto';

@ApiTags('DIMS')
@Controller('dims')
export class DimsController {
  constructor(
    private readonly listDimsUseCase: ListDimsUseCase,
    private readonly createDimsUseCase: CreateDimsUseCase,
    private readonly getDimsUseCase: GetDimsUseCase,
    private readonly updateDimsUseCase: UpdateDimsUseCase,
    private readonly deleteDimsUseCase: DeleteDimsUseCase,
    private readonly generateDimsUseCase: GenerateDimsUseCase,
    private readonly validateDimsUseCase: ValidateDimsUseCase,
    private readonly exportDimsUseCase: ExportDimsUseCase,
    private readonly emailDimsUseCase: EmailDimsUseCase,
    private readonly submitDimsUseCase: SubmitDimsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar DIMS' })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async list(
    @Query('estado') estado?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listDimsUseCase.execute({
      estado,
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear una DIMS' })
  async create(@Body() body: CreateDimsDto) {
    return this.createDimsUseCase.execute(body);
  }

  @Get(':dimsId')
  @ApiOperation({ summary: 'Obtener una DIMS' })
  async get(@Param('dimsId') dimsId: string) {
    return this.getDimsUseCase.execute(dimsId);
  }

  @Put(':dimsId')
  @ApiOperation({ summary: 'Actualizar una DIMS' })
  async update(@Param('dimsId') dimsId: string, @Body() body: DimsUpdateDto) {
    return this.updateDimsUseCase.execute(dimsId, body);
  }

  @Delete(':dimsId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una DIMS' })
  async remove(@Param('dimsId') dimsId: string) {
    await this.deleteDimsUseCase.execute(dimsId);
  }

  @Post(':dimsId/generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar el formulario y la liquidación' })
  async generate(@Param('dimsId') dimsId: string) {
    return this.generateDimsUseCase.execute(dimsId);
  }

  @Post(':dimsId/validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validar contra SUMA' })
  async validate(@Param('dimsId') dimsId: string) {
    return this.validateDimsUseCase.execute(dimsId);
  }

  @Post(':dimsId/export')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exportar la DIMS' })
  async export(@Param('dimsId') dimsId: string, @Body() body: ExportDimsDto) {
    return this.exportDimsUseCase.execute(dimsId, body.formato);
  }

  @Post(':dimsId/email')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enviar la DIMS por correo' })
  async email(@Param('dimsId') dimsId: string, @Body() body: EmailDimsDto) {
    await this.emailDimsUseCase.execute(dimsId, body.destinatario, body.formato);
  }

  @Post(':dimsId/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transmitir la DIMS a SUMA' })
  async submit(@Param('dimsId') dimsId: string) {
    return this.submitDimsUseCase.execute(dimsId);
  }
}
