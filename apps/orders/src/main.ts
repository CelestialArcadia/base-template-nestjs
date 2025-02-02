import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { OrdersModule } from './orders.module';

async function bootstrap() {
  const app = await NestFactory.create(OrdersModule);
  // Use global pipes
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get(ConfigService);
  app.listen(configService.getOrThrow('APP_PORT'));
}
bootstrap();
