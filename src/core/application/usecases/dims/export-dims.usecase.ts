import { Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { ExportFormat, ExportResult } from '../../../domain/models/aduana';
import { GetDimsUseCase } from './get-dims.usecase';

const EXTENSIONS: Record<ExportFormat, string> = {
  xml: 'xml',
  pdf: 'pdf',
  json: 'json',
  print: 'pdf',
};

@Injectable()
export class ExportDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string, formato: ExportFormat): Promise<ExportResult> {
    const dims = await this.getDimsUseCase.execute(id);
    const ext = EXTENSIONS[formato] ?? 'bin';
    const nombreArchivo = `${dims.id}.${ext}`;
    const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      formato,
      url: `https://files.dims.ai/exports/${nombreArchivo}`,
      nombreArchivo,
      tamanoBytes: JSON.stringify(dims).length,
      expiraEn: expira,
    };
  }
}
