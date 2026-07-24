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
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
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

    this.validarDatosGenerales(dims, issues);
    this.validarImportador(dims, issues);
    this.validarTransaccion(dims, issues);

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

  // Campos siempre requeridos en Datos Generales (régimen, modalidad, aduana y
  // Parte de Recepción). Ver "Campos requeridos de la DIMS", sección 5.
  private validarDatosGenerales(dims: DimsEntity, issues: ValidationIssue[]) {
    if (!dims.aduanaIngreso) {
      issues.push({
        nivel: 'error',
        campo: 'aduanaIngreso',
        mensaje: 'La aduana de despacho es obligatoria.',
      });
    }
    if (!dims.regimen) {
      issues.push({
        nivel: 'error',
        campo: 'regimen',
        mensaje: 'El destino/régimen aduanero es obligatorio.',
      });
    }
    if (!dims.modalidad) {
      issues.push({
        nivel: 'error',
        campo: 'modalidad',
        mensaje: 'La modalidad del régimen es obligatoria.',
      });
    }
    // Nº de Parte de Recepción requerido cuando parteRecepcionSiNo = true.
    if (dims.parteRecepcionSiNo && !dims.parteRecepcion) {
      issues.push({
        nivel: 'error',
        campo: 'parteRecepcion',
        mensaje: 'El número de Parte de Recepción es obligatorio.',
      });
    }
    // Información adicional requerida solo cuando se marca requiereInfAdicional.
    if (dims.requiereInfAdicional && !dims.infAdicional) {
      issues.push({
        nivel: 'error',
        campo: 'infAdicional',
        mensaje: 'La información adicional es obligatoria.',
      });
    }
  }

  private validarImportador(dims: DimsEntity, issues: ValidationIssue[]) {
    const imp = dims.importador ?? {};
    const numeroDoc = imp.numeroDocumento || dims.nit;
    if (!imp.tipoDocumento) {
      issues.push({
        nivel: 'error',
        campo: 'importador.tipoDocumento',
        mensaje: 'El tipo de documento del importador es obligatorio.',
      });
    }
    if (!numeroDoc) {
      issues.push({
        nivel: 'error',
        campo: 'importador.numeroDocumento',
        mensaje: 'El número de documento del importador es obligatorio.',
      });
    }
    if (!imp.nombreRazonSocial) {
      issues.push({
        nivel: 'error',
        campo: 'importador.nombreRazonSocial',
        mensaje: 'El nombre / razón social del importador es obligatorio.',
      });
    }
    if (!imp.domicilio) {
      issues.push({
        nivel: 'error',
        campo: 'importador.domicilio',
        mensaje: 'El domicilio legal del importador es obligatorio.',
      });
    }
    if (!dims.departamentoDestino) {
      issues.push({
        nivel: 'error',
        campo: 'departamentoDestino',
        mensaje: 'El departamento de destino es obligatorio.',
      });
    }
  }

  private validarTransaccion(dims: DimsEntity, issues: ValidationIssue[]) {
    const tx = dims.transaccion ?? {};
    if (!tx.valorFobUsd || tx.valorFobUsd <= 0) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.valorFobUsd',
        mensaje: 'El valor FOB total (USD) es obligatorio y debe ser mayor a 0.',
      });
    }
    if (!tx.cantidadBultos || tx.cantidadBultos <= 0) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.cantidadBultos',
        mensaje: 'La cantidad total de bultos debe ser mayor a 0.',
      });
    }
    if (!tx.pesoBruto || tx.pesoBruto <= 0) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.pesoBruto',
        mensaje: 'El peso bruto total debe ser mayor a 0.',
      });
    }
    if (
      tx.pesoNeto !== undefined &&
      tx.pesoBruto !== undefined &&
      tx.pesoNeto > tx.pesoBruto
    ) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.pesoNeto',
        mensaje: 'El peso neto no puede ser mayor al peso bruto.',
      });
    }
    // Modalidades courier/postal: peso bruto máximo 40 kg.
    const esCourierPostal = ['4107', '9100', '9200', '9220'].includes(
      dims.modalidad ?? '',
    );
    if (esCourierPostal && (tx.pesoBruto ?? 0) > 40) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.pesoBruto',
        mensaje:
          'En modalidades courier/postal el peso bruto no puede superar 40 kg.',
      });
    }
    // Flete/seguro declarados solo son requeridos cuando su indicador está en Sí.
    if (tx.fleteDeclaradoSiNo && (tx.fleteUsd === undefined || tx.fleteUsd < 0)) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.fleteUsd',
        mensaje: 'El flete declarado es obligatorio cuando se declara flete.',
      });
    }
    if (
      tx.seguroDeclaradoSiNo &&
      (tx.seguroUsd === undefined || tx.seguroUsd < 0)
    ) {
      issues.push({
        nivel: 'error',
        campo: 'transaccion.seguroUsd',
        mensaje: 'El seguro declarado es obligatorio cuando se declara seguro.',
      });
    }
  }
}
