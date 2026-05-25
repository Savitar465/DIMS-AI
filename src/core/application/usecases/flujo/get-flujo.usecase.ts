import { Inject, Injectable } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import {
  DraftInProgress,
  FlowStep,
  FlowStepId,
  FlujoData,
} from '../../../domain/models/aduana';

export const FLOW_STEPS: FlowStep[] = [
  {
    id: 'factura',
    n: 1,
    title: 'Cargar factura',
    short: 'Sube PDF o foto de la factura comercial',
    detail:
      'La IA extrae proveedor, ítems, cantidades y precios de la factura cargada.',
    duration: '~30 seg',
    hu: 'HU-003',
  },
  {
    id: 'editar',
    n: 2,
    title: 'Editar datos',
    short: 'Revisa y corrige los datos extraídos',
    detail:
      'Verifica proveedor, cabecera y totales; corrige los campos con baja confianza.',
    duration: '~2 min',
    hu: 'HU-004',
  },
  {
    id: 'dims',
    n: 3,
    title: 'Generar DIMS',
    short: 'La IA arma el formulario y calcula la liquidación',
    detail:
      'Se calcula CIF, GA, IVA e ICE según la subpartida de cada ítem.',
    duration: '~15 seg',
    hu: 'HU-005',
  },
  {
    id: 'validar',
    n: 4,
    title: 'Validar',
    short: 'Comprueba consistencia contra SUMA',
    detail:
      'Valida vigencia de subpartidas, consistencia tributaria y restricciones.',
    duration: '~20 seg',
    hu: 'HU-006',
  },
  {
    id: 'exportar',
    n: 5,
    title: 'Exportar / Enviar',
    short: 'Exporta o transmite la DIMS a SUMA',
    detail: 'Genera el XML/PDF oficial o transmite la declaración a SUMA.',
    duration: '~10 seg',
    hu: 'HU-007',
  },
];

@Injectable()
export class GetFlujoUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
  ) {}

  async execute(): Promise<FlujoData> {
    const borradores = await this.dimsRepository.findDrafts();
    const drafts = borradores.map((d) => this.toDraft(d));
    return { steps: FLOW_STEPS, drafts };
  }

  private toDraft(d: DimsEntity): DraftInProgress {
    const sinClasificar = (d.items || []).filter((it) => !it.subpartida).length;
    const valor = d.liquidacion?.cif ?? this.sumItems(d.items);

    let stepIdx = 1;
    let stepScreen: FlowStepId = 'editar';
    let pendiente = 'Revisar datos extraídos';

    if (sinClasificar > 0) {
      stepIdx = 1;
      stepScreen = 'editar';
      pendiente = `${sinClasificar} ítem sin clasificar`;
    } else if (!d.liquidacion) {
      stepIdx = 2;
      stepScreen = 'dims';
      pendiente = 'Generar liquidación';
    } else if (!d.validacion) {
      stepIdx = 3;
      stepScreen = 'validar';
      pendiente = 'Validar contra SUMA';
    } else if (!d.validacion.valido) {
      stepIdx = 3;
      stepScreen = 'validar';
      pendiente = 'Corregir errores de validación';
    } else {
      stepIdx = 4;
      stepScreen = 'exportar';
      pendiente = 'Listo para exportar o enviar';
    }

    return {
      id: d.id,
      proveedor: d.proveedor ?? '',
      items: (d.items || []).length,
      valor,
      actualizada: this.relativeTime(d.actualizadaEn),
      stepIdx,
      stepScreen,
      pendiente,
    };
  }

  private sumItems(items: any[]): number {
    return (items || []).reduce((acc, it) => acc + (it?.subtotal || 0), 0);
  }

  private relativeTime(date?: Date): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const diffMs = Date.now() - d.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'hace unos segundos';
    if (min < 60) return `hace ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
  }
}
