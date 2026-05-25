import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { ExportFormat } from '../../../domain/models/aduana';
import { GetDimsUseCase } from './get-dims.usecase';

@Injectable()
export class EmailDimsUseCase {
  private readonly logger = new Logger(EmailDimsUseCase.name);

  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(
    id: string,
    destinatario: string,
    formato: ExportFormat,
  ): Promise<void> {
    const dims = await this.getDimsUseCase.execute(id);
    // Funcional mock: el envío real se delega a un proveedor de correo.
    this.logger.log(
      `Encolando envío de ${dims.id} (${formato}) a ${destinatario}`,
    );
  }
}
