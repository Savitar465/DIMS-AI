import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class Response<T> {
  @ApiProperty()
  code: HttpStatus;
  @ApiProperty()
  message: string;
  @ApiProperty()
  data: T;

  constructor(props: { code: HttpStatus, message: string, data: T }) {
    this.code = props.code;
    this.message = props.message;
    this.data = props.data;
  }

  static buildResponse<T>(res: { code: HttpStatus, message: string, data: T }): Response<T> {
    return new Response<T>({
      code: res.code,
      message: res.message,
      data: res.data,
    });
  }
}