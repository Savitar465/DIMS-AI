import { Sala } from "../../models/sala";
import { SalaEntity } from "src/infraestructure/persistance/entities/sala.entity";
import { CriteriaQuery } from "src/infraestructure/shared/criteria/type-orm.helper";
import { PaginatedResource } from "src/infraestructure/shared/criteria/paginated-resource";

export interface SalaRepository {
    save(sala: Sala): Promise<SalaEntity>;
    findById(id: string): Promise<SalaEntity>;
    update(sala: Sala): Promise<SalaEntity>;
    searchByCriteria(criteria: CriteriaQuery): Promise<PaginatedResource<Sala>>;
}