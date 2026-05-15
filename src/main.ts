import { Logger, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildCorsOptions } from './common/security/cors-options';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Global validation keeps request payloads clean and predictable.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // These guards are global, so every endpoint is protected by default.
  // Public endpoints must explicitly use @Public() decorator.
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  app.enableCors(buildCorsOptions());
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.CORS_ORIGINS?.trim()
  ) {
    new Logger('Bootstrap').warn(
      'CORS_ORIGINS kosong — semua origin diizinkan. Set CORS_ORIGINS ke URL frontend untuk produksi.',
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Physiotherapy Booking API')
    .setDescription(
      'Booking Management System API for Admin, Patient, and Physiotherapist roles.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  // Bind to 0.0.0.0 supaya container/PaaS (Railway, dll.) bisa menjangkau service
  // dari luar; default Nest hanya listen di interface lokal.
  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(`API is running on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs available at /docs`);
}

void bootstrap();
