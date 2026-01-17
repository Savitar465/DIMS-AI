import { Cambio, Evento, Mensaje } from '../../../core/domain/models/evento';
import { EventoResponse } from '../../dtos/response/evento.response';
import { Usuario } from '../../../core/domain/models/usuario';
import { Sala } from '../../../core/domain/models/sala';
import { UsuarioMapper } from './usuario.mapper';
import { SalaMapper } from './sala.mapper';

export class EventoMapper {

  static async toResponse(evento: Evento<Mensaje | Cambio>, usuario?: Usuario, usuariosMencionados?: Usuario[], sala?: Sala): Promise<EventoResponse> {
    const usuarioResponse = usuario ? await UsuarioMapper.toResponse(usuario) : evento.usuario;
    const usuariosMencionadosResponse = usuariosMencionados?
      await Promise.all(usuariosMencionados.map(usuario => UsuarioMapper.toResponse(usuario)))
      : evento.usuariosMencionados;
    const salaResponse = sala ? await SalaMapper.toResponse(sala) : evento.sala;
    return await EventoResponse.create({
      id: evento.id,
      usuario: usuarioResponse,
      data: evento.data,
      tipo: evento.tipo,
      sala: salaResponse,
      usuariosMencionados: usuariosMencionadosResponse,
      usuCre: evento.usuCre,
      fecCre: evento.fecCre,
      usuMod: evento.usuMod,
      fecMod: evento.fecMod,
    });
  }
}