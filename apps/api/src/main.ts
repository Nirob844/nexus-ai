import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Global Input Validation & Transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('NEXUS AI - Core Backend API')
    .setDescription(
      'Multi-Tenant AI-Powered Business Operations & Customer Support SaaS API Documentation',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT Bearer token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('System', 'System and health endpoints')
    .addTag('Authentication', 'User authentication, registration, and session rotation')
    .addTag('Organizations', 'Multi-tenant organization workspaces and membership')
    .addTag('Users', 'User account and profile management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'NEXUS AI API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.API_PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 NEXUS AI API is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger Documentation available at: http://localhost:${port}/docs`);
}

bootstrap();
