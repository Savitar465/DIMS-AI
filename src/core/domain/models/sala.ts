import { AggregateRoot } from '@nestjs/cqrs';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoEnum } from '../../shared/enums/estado.enum';
import { SalaEntity } from '../../../infraestructure/persistance/entities/sala.entity';

export type SalaProps = {
  id: string;
  usuarios: string[];
  usuAudit: string;
  estado: EstadoEnum;
};

export class Sala extends AggregateRoot {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  usuarios?: string[];

  @ApiProperty()
  usuMod?: string;

  @ApiProperty()
  fecMod?: Date;

  @ApiProperty()
  usuCre?: string;

  @ApiProperty()
  fecCre?: Date;

  @ApiProperty()
  estado?: EstadoEnum;

  constructor(props: {
    id?: string;
    usuarios?: string[];
    usuMod?: string;
    fecMod?: Date;
    usuCre?: string;
    fecCre?: Date;
    estado?: number;
  }) {
    super();
    this.autoCommit = true;
    this.id = props.id;
    this.usuarios = props.usuarios;
    this.usuMod = props.usuMod;
    this.fecMod = props.fecMod;
    this.usuCre = props.usuCre;
    this.fecCre = props.fecCre;
    this.estado = props.estado;
  }

  static async create(props: Partial<SalaProps>): Promise<Sala> {
    return new Sala({
      usuarios: props.usuarios,
      usuMod: props.usuAudit,
      fecMod: new Date(),
      usuCre: props.usuAudit,
      fecCre: new Date(),
      estado: EstadoEnum.ACTIVO,
      ...props,
    });
  }

  static fromEntity(plainData: SalaEntity): Sala {
    return new Sala({
        id: plainData._id.toHexString(),
        usuarios: plainData.usuarios.map(usuario => usuario.toHexString()),
        usuMod: plainData.usuMod,
        fecMod: plainData.fecMod,
        usuCre: plainData.usuCre,
        fecCre: plainData.fecCre,
        estado: plainData.estado,
      },
    );
  }
}
