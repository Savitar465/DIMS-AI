import { Usuario } from '../../../core/domain/models/usuario';
import { UsuarioResponse } from '../../dtos/response/usuario.response';

export class UsuarioMapper {

  static toResponse(usuario: Usuario) {
    return UsuarioResponse.create({
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      password: usuario.password,
      usuCre: usuario.usuCre,
      fecCre: usuario.fecCre,
      usuMod: usuario.usuMod,
      fecMod: usuario.fecMod,
    })
  }
}