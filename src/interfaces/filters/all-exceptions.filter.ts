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

    response.status(status).json(this.toErrorBody(status, message));
  }

  // Normalize any thrown error into the OpenAPI `Error` schema: { error: { code, message, details? } }.
  private toErrorBody(status: number, message: unknown): any {
    if (
      message &&
      typeof message === this.OBJECT &&
      typeof (message as any).error === this.OBJECT &&
      (message as any).error !== null
    ) {
      // Already in the expected shape (thrown by our use cases).
      return { error: (message as any).error };
    }

    const code = this.statusToCode(status);

    if (message && typeof message === this.OBJECT) {
      const m = message as any;
      const inner = m.message;
      if (Array.isArray(inner)) {
        return {
          error: { code, message: 'Solicitud inválida.', details: inner },
        };
      }
      return { error: { code, message: inner ?? 'Error' } };
    }

    return { error: { code, message: String(message ?? 'Error') } };
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'bad_request',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      413: 'payload_too_large',
      415: 'unsupported_media_type',
      422: 'unprocessable_entity',
      500: 'internal_error',
    };
    return map[status] ?? 'error';
  }
}
