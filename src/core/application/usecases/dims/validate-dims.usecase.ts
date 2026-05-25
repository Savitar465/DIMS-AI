import { Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { ValidationIssue, ValidationResult } from '../../../domain/models/aduana';
import { GetDimsUseCase } from './get-dims.usecase';

@Injectable()
export class ValidateDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
    private readonly getDimsUseCase: GetDimsUseCase,
  ) {}

  async execute(id: string): Promise<ValidationResult> {
    const dims = await this.getDimsUseCase.execute(id);
    const issues: ValidationIssue[] = [];

    if (!dims.nit) {
      issues.push({
        nivel: 'error',
        campo: 'nit',
        mensaje: 'El NIT del importador es obligatorio.',
      });
    }

    if (!dims.items || dims.items.length === 0) {
      issues.push({
        nivel: 'error',
        campo: 'items',
        mensaje: 'La DIMS no tiene ítems.',
      });
    }

    for (let i = 0; i < (dims.items || []).length; i++) {
      const item = dims.items[i];
      if (!item.subpartida) {
        issues.push({
          nivel: 'error',
          campo: `items[${i}].subpartida`,
          mensaje: `El ítem "${item.descripcion}" no tiene subpartida asignada.`,
        });
        continue;
      }
      const sub = await this.subpartidaRepository.findByCode(item.subpartida);
      if (!sub) {
        issues.push({
          nivel: 'error',
          campo: `items[${i}].subpartida`,
          mensaje: `La subpartida ${item.subpartida} no es vigente en el Arancel.`,
        });
      } else if (item.confidence < 70) {
        issues.push({
          nivel: 'advertencia',
          campo: `items[${i}].subpartida`,
          mensaje: `La clasificación del ítem "${item.descripcion}" tiene baja confianza; revísela.`,
        });
      }
    }

    if (!dims.liquidacion) {
      issues.push({
        nivel: 'advertencia',
        campo: 'liquidacion',
        mensaje: 'La liquidación aún no fue generada (POST /dims/{id}/generate).',
      });
    }

    const valido = !issues.some((i) => i.nivel === 'error');
    const validacion: ValidationResult = {
      valido,
      validadaEn: new Date().toISOString(),
      issues,
    };

    dims.validacion = validacion;
    await this.dimsRepository.save(dims);
    return validacion;
  }
}
