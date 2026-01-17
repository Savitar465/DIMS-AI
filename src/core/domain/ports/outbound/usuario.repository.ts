import { Usuario } from "../../models/usuario";
import { UsuarioEntity } from "src/infraestructure/persistance/entities/usuario.entity";
import { CriteriaQuery } from '../../../../infraestructure/shared/criteria/type-orm.helper';
import { PaginatedResource } from '../../../../infraestructure/shared/criteria/paginated-resource';

export interface UsuarioRepository {
    save(usuario: Usuario): Promise<UsuarioEntity>;
    findById(id: string): Promise<Usuario>;
    searchByCriteria(criteria: CriteriaQuery): Promise<PaginatedResource<Usuario>>;
    update(usuario: Usuario): Promise<UsuarioEntity>;
}