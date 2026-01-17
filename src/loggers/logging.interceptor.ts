import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    
    const now = Date.now();
    
    return next
      .handle()
      .pipe(
        tap(() => {
          const logMessage = {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            status: response.statusCode,
            message: 'Request completed successfully',
            responseTime: `${Date.now() - now}ms`
          };
          this.logger.log(logMessage);
        })
      );
  }
}
