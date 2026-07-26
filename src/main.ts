import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './interfaces/filters/all-exceptions.filter';
import { LoggingInterceptor } from './loggers/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

declare const module: any;

/**
 * Construye la aplicación ya configurada, sin escuchar en un puerto.
 *
 * Serverless y servidor de toda la vida necesitan exactamente la misma app
 * configurada, y difieren solo en el último paso: uno la pone a escuchar, el
 * otro se la entrega a la plataforma. Con esto ese último paso es lo único que
 * cambia entre entornos — un filtro o un pipe que se agregue acá vale para los
 * dos, sin quedar aplicado en uno y olvidado en el otro.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('Microservicio de chat')
    .setDescription('Microservicio de chat')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  SwaggerModule.setup('docs', app, document, {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
    ],
  });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  return app;
}

async function bootstrap() {
  const app = await createApp();
  await app.listen(parseInt(process.env.PORT, 10) || 3001);
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

// En serverless no hay puerto que ocupar: la plataforma invoca el handler de
// `api/index.js`, que importa `createApp`. Arrancar el servidor acá además
// levantaría un listener por cada import del módulo.
if (!process.env.VERCEL) {
  bootstrap();
}
