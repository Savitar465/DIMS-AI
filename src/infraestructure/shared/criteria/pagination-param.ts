import { ApiProperty } from '@nestjs/swagger/dist/decorators/api-property.decorator';

export class Pagination {
  @ApiProperty()
  page: number;
  limit?: number;
  @ApiProperty()
  size: number;
  offset?: number;
}