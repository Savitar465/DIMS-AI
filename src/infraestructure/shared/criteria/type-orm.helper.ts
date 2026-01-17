import { MetaModel } from '../../persistance/metamodel/meta-model';
import { BSONType } from '../constants/bson-type';
import { ObjectId } from 'mongodb';
import { ApiPropertyOptional } from '@nestjs/swagger/dist/decorators/api-property.decorator';
import { Sorting } from './sorting-params';
import { Filtering, FilterRule } from './filter-params';
import { Pagination } from './pagination-param';

const convertToObjectId = (value: string) => {
  if (ObjectId.isValid(value)) return new ObjectId(value);
  throw new Error('Invalid ObjectId format');
};

const handleObjectIdConversion = (filter: Filtering, metamodel: MetaModel[]) => {
  let value = filter.value;
  if (metamodel.some(m => m.name === filter.property && m.type === BSONType.OBJECTID)) {
    filter.value = (filter.rule === FilterRule.IN || filter.rule === FilterRule.NOT_IN)
      ? value.split(',').map(convertToObjectId)
      : convertToObjectId(value);

  } else if (metamodel.some(m => m.name === filter.property && m.type === BSONType.DATE)) {
    filter.value = (filter.rule === FilterRule.IN || filter.rule === FilterRule.NOT_IN)
      ? value.split(',').map((date: string) => new Date(date))
      : new Date(value);
  }

};

const getFilterCondition = (filter: Filtering) => {
  switch (filter.rule) {
    case FilterRule.EQUALS:
      return { [filter.property]: filter.value };
    case FilterRule.NOT_EQUALS:
      return { [filter.property]: { $ne: filter.value } };
    case FilterRule.GREATER_THAN:
      return { [filter.property]: { $gt: filter.value } };
    case FilterRule.GREATER_THAN_OR_EQUALS:
      return { [filter.property]: { $gte: filter.value } };
    case FilterRule.LESS_THAN:
      return { [filter.property]: { $lt: filter.value } };
    case FilterRule.LESS_THAN_OR_EQUALS:
      return { [filter.property]: { $lte: filter.value } };
    case FilterRule.LIKE:
      return { [filter.property]: new RegExp(`${filter.value}`) };
    case FilterRule.NOT_LIKE:
      return { [filter.property]: { $not: new RegExp(`${filter.value}`) } };
    case FilterRule.IN:
      return { [filter.property]: { $in: (Array.isArray(filter.value) ? filter.value : filter.value.split(',')) } };
    case FilterRule.NOT_IN:
      return { [filter.property]: { $nin: (Array.isArray(filter.value) ? filter.value : filter.value.split(',')) } };
    default:
      return {};
  }
};

export const getWhere = (filter: Filtering, metamodel: MetaModel[]) => {
  if (!filter) return {};

  handleObjectIdConversion(filter, metamodel);
  return getFilterCondition(filter);
};

export const getOrder = (sort: Sorting) => sort ? { [sort.property]: sort.direction } : {};

export class CriteriaQuery {
  @ApiPropertyOptional()
  pagination?: Pagination;
  @ApiPropertyOptional()
  sort?: Sorting;
  @ApiPropertyOptional()
  filter?: Filtering;
}

export function setPagination(pagination: Pagination) {
  pagination.limit = pagination.size;
  pagination.offset = pagination.page * pagination.limit;
}