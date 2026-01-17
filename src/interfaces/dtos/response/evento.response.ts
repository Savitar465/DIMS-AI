import { Cambio, Mensaje } from '../../../core/domain/models/evento';
import { UsuarioResponse } from './usuario.response';
import { SalaResponse } from './sala.response';
import { ApiProperty } from '@nestjs/swagger';

export class EventoResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  usuario: UsuarioResponse|string;

  @ApiProperty()
  data: Mensaje | Cambio;

  @ApiProperty()
  tipo: string;

  @ApiProperty()
  sala: SalaResponse|string;

  @ApiProperty()
  usuariosMencionados: UsuarioResponse[]| string[];

  @ApiProperty()
  usuMod: string;

  @ApiProperty()
  fecMod: Date;

  @ApiProperty()
  usuCre: string;

  @ApiProperty()
  fecCre: Date;

  constructor(props: {
    id: string;
    usuario: UsuarioResponse|string;
    data: Mensaje | Cambio;
    tipo: string;
    sala: SalaResponse|string;
    usuariosMencionados: UsuarioResponse[]|string[];
    usuMod: string;
    fecMod: Date;
    usuCre: string;
    fecCre: Date;
  }) {
    this.id = props.id;
    this.usuario = props.usuario;
    this.data = props.data;
    this.tipo = props.tipo;
    this.sala = props.sala;
    this.usuariosMencionados = props.usuariosMencionados;
    this.usuMod = props.usuMod;
    this.fecMod = props.fecMod;
    this.usuCre = props.usuCre;
    this.fecCre = props.fecCre;
  }

  static async create(props: {
    id: string;
    usuario: UsuarioResponse|string;
    data: Mensaje | Cambio;
    tipo: string;
    sala: SalaResponse|string;
    usuariosMencionados: UsuarioResponse[]|string[];
    usuMod: string;
    fecMod: Date;
    usuCre: string;
    fecCre: Date;
  }): Promise<EventoResponse> {
    return new EventoResponse(props);
  }
}