import { MetaModel } from './meta-model';
import { BSONType } from '../../shared/constants/bson-type';

export enum SalaEnum {
  ID = '_id',
  USUARIOS = 'usuarios',
  USUCRE = 'usuCre',
  FECCRE = 'fecCre',
  USUMOD = 'usuMod',
  FECMOD = 'fecMod',
  ESTADO = 'estado',
}

export const salaMetaModel: MetaModel[] = [
  { name: SalaEnum.ID, type: BSONType.OBJECTID },
  // usuarios is an array of ObjectId; treat as OBJECTID for IN filters
  { name: SalaEnum.USUARIOS, type: BSONType.OBJECTID },
  { name: SalaEnum.USUCRE, type: BSONType.STRING },
  { name: SalaEnum.FECCRE, type: BSONType.DATE },
  { name: SalaEnum.USUMOD, type: BSONType.STRING },
  { name: SalaEnum.FECMOD, type: BSONType.DATE },
  { name: SalaEnum.ESTADO, type: BSONType.STRING },
];