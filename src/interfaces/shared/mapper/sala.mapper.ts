import { Sala } from '../../../core/domain/models/sala';
import { SalaResponse } from '../../dtos/response/sala.response';
import { Usuario } from '../../../core/domain/models/usuario';
import { UsuarioMapper } from './usuario.mapper';

export class SalaMapper {

  static async toResponse(sala: Sala, usuarios?: Usuario[]): Promise<SalaResponse> {

    const usuariosResponse = usuarios
      ? await Promise.all(usuarios.map(usuario => UsuarioMapper.toResponse(usuario)))
      : sala.usuarios;

    return SalaResponse.create({
      id: sala.id,
      usuarios: usuariosResponse,
      usuCre: sala.usuCre,
      fecCre: sala.fecCre,
      usuMod: sala.usuMod,
      fecMod: sala.fecMod,
    });
  }
}