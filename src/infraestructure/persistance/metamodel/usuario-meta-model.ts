
import { MetaModel } from './meta-model';
import { BSONType } from '../../shared/constants/bson-type';


export enum UsuarioEnum {
  ID = '_id',
  USERNAME = 'username',
  EMAIL = 'email',
  PASSWORD = 'password',
  USUCRE = 'usuCre',
  FECCRE = 'fecCre',
  USUMOD = 'usuMod',
  FECMOD = 'fecMod',
  ESTADO = 'estado',
}

export const usuarioMetaModel: MetaModel[] = [
  { name: UsuarioEnum.ID, type: BSONType.OBJECTID },
  { name: UsuarioEnum.USERNAME, type: BSONType.STRING },
  { name: UsuarioEnum.EMAIL, type: BSONType.STRING },
  { name: UsuarioEnum.PASSWORD, type: BSONType.STRING },
  { name: UsuarioEnum.USUCRE, type: BSONType.STRING },
  { name: UsuarioEnum.FECCRE, type: BSONType.DATE },
  { name: UsuarioEnum.USUMOD, type: BSONType.STRING },
  { name: UsuarioEnum.FECMOD, type: BSONType.DATE },
  { name: UsuarioEnum.ESTADO, type: BSONType.STRING },
];