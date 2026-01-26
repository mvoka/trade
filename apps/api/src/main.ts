import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { config } from '@trades/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix(config.API_PREFIX);

  // CORS
  app.enableCors({
    origin: [
      config.SMB_APP_URL,
      config.PRO_APP_URL,
      config.ADMIN_APP_URL,
      config.OPERATOR_APP_URL,
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Trades Dispatch Platform API')
    .setDescription('API documentation for the Trades Dispatch Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('pros', 'Pro profile management')
    .addTag('orgs', 'Organization management')
    .addTag('verification', 'Verification and compliance')
    .addTag('jobs', 'Job management')
    .addTag('dispatch', 'Dispatch engine')
    .addTag('booking', 'Booking management')
    .addTag('leads', 'Lead intake')
    .addTag('messages', 'Messaging')
    .addTag('admin', 'Admin endpoints')
    .addTag('operator', 'Operator endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.API_PORT);
  console.log(`🚀 API running on http://localhost:${config.API_PORT}`);
  console.log(`📚 Swagger docs at http://localhost:${config.API_PORT}/docs`);
}

bootstrap();
