import { CriteriaQuery } from '../../../../infraestructure/shared/criteria/type-orm.helper';

export class FindSalaSearch {
  constructor(public readonly criteria: CriteriaQuery) {}
}
