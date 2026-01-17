import { CriteriaQuery } from '../../../../infraestructure/shared/criteria/type-orm.helper';

export class FindUsuarioSearch {
  constructor(public readonly criteria: CriteriaQuery) {
  }
}