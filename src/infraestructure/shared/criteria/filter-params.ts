import { ApiProperty } from '@nestjs/swagger/dist/decorators/api-property.decorator';

export class Filtering {
  @ApiProperty()
  property: string;
  @ApiProperty()
  rule: string;
  @ApiProperty({ type: String })
  value: any;
}

// valid filter rules
export enum FilterRule {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUALS = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUALS = 'lte',
  LIKE = 'like',
  NOT_LIKE = 'nlike',
  IN = 'in',
  NOT_IN = 'nin'
}

