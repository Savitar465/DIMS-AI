import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly OBJECT = 'object';
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : exception;

    // Safely stringify message to avoid throws when message contains circular refs
    let messageStr: any;
    if (typeof message === this.OBJECT) {
      try {
        messageStr = JSON.stringify(message);
      } catch {
        try {
          // Fallback to a best-effort string conversion
          messageStr = String(message);
        } catch {
          messageStr = '[unserializable error]';
        }
      }
    } else {
      messageStr = message;
    }

    const logMessage = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      message: messageStr,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logMessage);
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(logMessage);
    } else {
      this.logger.log(logMessage); 
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === this.OBJECT ? JSON.stringify(message) : message
    });
  }
}
