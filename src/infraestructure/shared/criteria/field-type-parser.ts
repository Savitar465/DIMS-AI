import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ObjectId } from 'mongodb';

export enum FieldType {
  BOOLEAN = 'BOOLEAN',
  CHAR = 'CHAR',
  DATE = 'DATE',
  DOUBLE = 'DOUBLE',
  INTEGER = 'INTEGER',
  LONG = 'LONG',
  STRING = 'STRING',
  OBJECTID = 'OBJECTID',
}

export class FieldTypeParser {
  @InjectPinoLogger(FieldTypeParser.name)
  private static logger: PinoLogger;

  static parse(type: FieldType, value: string): any {
    switch (type) {
      case FieldType.BOOLEAN:
        return Boolean(value);
      case FieldType.CHAR:
        return value.charAt(0);
      case FieldType.DATE:
        try {
          return Date.parse(value);
        } catch (e) {
          this.logger.info(`Failed to parse field type DATE: ${e.message}`);
          return null;
        }
      case FieldType.DOUBLE:
        return parseFloat(value);
      case FieldType.INTEGER:
        return parseInt(value, 10);
      case FieldType.LONG:
        return parseInt(value, 10);
      case FieldType.STRING:
        return value;
      case FieldType.OBJECTID:
        return new ObjectId(value);
      default:
        return value;
    }
  }
}