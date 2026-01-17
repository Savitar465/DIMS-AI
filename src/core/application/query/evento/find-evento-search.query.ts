import { CriteriaQuery } from '../../../../infraestructure/shared/criteria/type-orm.helper';

export class FindEventoSearch {
  constructor(public readonly criteria: CriteriaQuery) {}
}
