import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  assertProductionCorsOrigins,
  warnIfProductionJwtSecretWeak,
} from './common/security/jwt-config';
import { buildCorsOptions } from './common/security/cors-options';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { buildI18nValidationException } from './common/validation/i18n-validation.factory';

async function bootstrap(): Promise<void> {
  assertProductionCorsOrigins();
  warnIfProductionJwtSecretWeak();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: buildI18nValidationException,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  app.enableCors(buildCorsOptions());

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
  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(`API is running on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs available at /docs`);
}

void bootstrap();
