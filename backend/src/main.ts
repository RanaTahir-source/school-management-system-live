import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Public, unauthenticated school-logo images (Sidebar/login screen render
  // these via a plain <img src>, so they can't go through an auth-gated
  // endpoint like documents do). Kept in its own root, separate from the
  // private documents/certificates storage - see settings/logo-storage.service.ts.
  app.useStaticAssets(
    process.env.UPLOADS_DIR ? join(process.env.UPLOADS_DIR, 'logos') : join(process.cwd(), 'uploads', 'logos'),
    { prefix: '/branding' },
  );

  // Reject any request body field that isn't explicitly defined in our DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`SMS backend running on http://localhost:${port}`);
}
bootstrap();
