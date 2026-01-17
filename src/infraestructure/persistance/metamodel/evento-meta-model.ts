import { MetaModel } from './meta-model';
import { BSONType } from '../../shared/constants/bson-type';

export enum EventoEnum {
  ID = '_id',
  DATA = 'data',
  TIPO = 'tipo',
  USUARIO = 'usuario',
  SALA = 'sala',
  USUARIOS_MENCIONADOS = 'usuariosMencionados',
  USUCRE = 'usuCre',
  FECCRE = 'fecCre',
  USUMOD = 'usuMod',
  FECMOD = 'fecMod',
  ESTADO = 'estado',
}

export const eventoMetaModel: MetaModel[] = [
  { name: EventoEnum.ID, type: BSONType.OBJECTID },
  // DATA is a complex object; omit typing for filtering specifics
  { name: EventoEnum.TIPO, type: BSONType.STRING },
  { name: EventoEnum.USUARIO, type: BSONType.OBJECTID },
  { name: EventoEnum.SALA, type: BSONType.OBJECTID },
  // usuariosMencionados is an array of ObjectId; treat as OBJECTID for IN filters
  { name: EventoEnum.USUARIOS_MENCIONADOS, type: BSONType.OBJECTID },
  { name: EventoEnum.USUCRE, type: BSONType.STRING },
  { name: EventoEnum.FECCRE, type: BSONType.DATE },
  { name: EventoEnum.USUMOD, type: BSONType.STRING },
  { name: EventoEnum.FECMOD, type: BSONType.DATE },
  { name: EventoEnum.ESTADO, type: BSONType.STRING },
];