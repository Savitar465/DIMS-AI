import { ApiProperty } from '@nestjs/swagger';
import { UsuarioResponse } from './usuario.response';

export class SalaResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  usuarios: UsuarioResponse[]|string[];

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
    usuarios: UsuarioResponse[]|string[];
    usuMod: string;
    fecMod: Date;
    usuCre: string;
    fecCre: Date;
  }) {
    this.id = props.id;
    this.usuarios = props.usuarios;
    this.usuMod = props.usuMod;
    this.fecMod = props.fecMod;
    this.usuCre = props.usuCre;
    this.fecCre = props.fecCre;
  }

  static async create(props: {
    id: string;
    usuarios: UsuarioResponse[]|string[];
    usuMod: string;
    fecMod: Date;
    usuCre: string;
    fecCre: Date;
  }): Promise<SalaResponse> {
    return new SalaResponse(props);
  }
}