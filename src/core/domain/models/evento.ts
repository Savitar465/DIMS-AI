import { AggregateRoot } from '@nestjs/cqrs';
import { EstadoEnum } from '../../shared/enums/estado.enum';
import { EventoEntity } from '../../../infraestructure/persistance/entities/evento.entity';

export type EventoProps = {
  id: string,
  usuario: string,
  data: Mensaje | Cambio,
  tipo: string,
  sala: string,
  usuariosMencionados: string[]
  usuAudit: string,
  estado: EstadoEnum
}
export type Mensaje = {
  contenido: string,
  media: {
    nombre: string,
    url: string,
    tipo: string
  }[]
}

export type Cambio = {
  campo: string,
  valorAnterior: string,
  valorNuevo: string
}

export class Evento<T> extends AggregateRoot {
  id?: string;
  usuario?: string;
  data?: T;
  tipo?: string;
  sala?: string;
  usuariosMencionados?: string[];
  estado?: EstadoEnum;
  usuMod?: string;
  fecMod?: Date;
  usuCre?: string;
  fecCre?: Date;

  constructor(props: {
    id?: string,
    usuario?: string,
    data?: T,
    tipo?: string,
    sala?: string,
    usuariosMencionados?: string[],
    estado?: EstadoEnum,
    usuMod?: string,
    fecMod?: Date,
    usuCre?: string,
    fecCre?: Date
  }) {
    super();
    this.autoCommit = true;
    this.id = props.id;
    this.usuario = props.usuario;
    this.data = props.data;
    this.tipo = props.tipo;
    this.sala = props.sala;
    this.usuariosMencionados = props.usuariosMencionados;
    this.estado = props.estado;
    this.usuMod = props.usuMod;
    this.fecMod = props.fecMod;
    this.usuCre = props.usuCre;
    this.fecCre = props.fecCre;
  }

  static async create(props: Partial<EventoProps>): Promise<Evento<Cambio | Mensaje>> {
    return new Evento({
      id: props.id,
      usuario: props.usuario,
      data: props.data,
      tipo: props.tipo,
      sala: props.sala,
      usuariosMencionados: props.usuariosMencionados,
      usuMod: props.usuAudit,
      fecMod: new Date(),
      usuCre: props.usuAudit,
      fecCre: new Date(),
      estado: props.estado,
      ...props,
    });
  }

  static fromEntity(plainData: EventoEntity): Evento<Cambio | Mensaje> {
    return new Evento({
        id: plainData._id.toHexString(),
        usuario: plainData.usuario.toHexString(),
        data: plainData.data,
        tipo: plainData.tipo,
        sala: plainData.sala.toHexString(),
        usuariosMencionados: plainData.usuariosMencionados.map(usuario => usuario.toHexString()),
        usuMod: plainData.usuMod,
        fecMod: plainData.fecMod,
        usuCre: plainData.usuCre,
        fecCre: plainData.fecCre,
        estado: plainData.estado,
      },
    );
  }
}