import { AggregateRoot } from "@nestjs/cqrs";
import { ApiProperty } from "@nestjs/swagger";
import { EstadoEnum } from '../../shared/enums/estado.enum';
import { UsuarioEntity } from '../../../infraestructure/persistance/entities/usuario.entity';

type Props = {
    id?: string;
    username?: string;
    email?: string;
    password?: string;
    usuAudit?: string;
};

export class Usuario extends AggregateRoot {
    @ApiProperty()
    id?: string;

    @ApiProperty()
    username?: string;

    @ApiProperty()
    email?: string;

    @ApiProperty()
    password?: string;

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
        username?: string;
        email?: string;
        password?: string;
        usuMod?: string;
        fecMod?: Date;
        usuCre?: string;
        fecCre?: Date;
        estado?: number;
    }) {
        super();
        this.autoCommit = true;
        this.id = props.id;
        this.username = props.username;
        this.email = props.email;
        this.password = props.password;
        this.usuMod = props.usuMod;
        this.fecMod = props.fecMod;
        this.usuCre = props.usuCre;
        this.fecCre = props.fecCre;
        this.estado = props.estado;
    }

    static async create(props: Props): Promise<Usuario> {
        return new Usuario({
            username: props.username,
            email: props.email,
            password: props.password,
            usuMod: props.usuAudit,
            fecMod: new Date(),
            usuCre: props.usuAudit,
            fecCre: new Date(),
            estado: EstadoEnum.ACTIVO,
        });
    }

    static async update(props: Props): Promise<Usuario> {
        return new Usuario({
            id: props.id,
            username: props.username,
            email: props.email,
            password: props.password,
            usuMod: props.usuAudit,
            fecMod: new Date(),
        });
    }

    static async deactivate(props: Props): Promise<Usuario> {
        return new Usuario({
            id: props.id,
            usuMod: props.usuAudit,
            fecMod: new Date(),
            estado: EstadoEnum.INACTIVO,
        });
    }

    static fromEntity(plainData: UsuarioEntity): Usuario {
        return new Usuario({
            id: plainData._id.toHexString(),
            username: plainData.username,
            email: plainData.email,
            password: plainData.password,
            usuCre: plainData.usuCre,
            fecCre: plainData.fecCre,
            usuMod: plainData.usuMod,
            fecMod: plainData.fecMod,
            estado: plainData.estado
        });
    }
}