import { ApiProperty } from '@nestjs/swagger/dist/decorators/api-property.decorator';

export class Sorting {
  @ApiProperty()
  property: string;
  @ApiProperty()
  direction: string;
}

