import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RmqService, DEAD_LETTER_EXCHANGE } from '@app/common';
import * as amqplib from 'amqplib';
import { BillingModule } from './billing.module';

/**
 * A dead-letter exchange that routes nowhere silently discards every message
 * sent to it. Declare the exchange, the parking queue, and the binding before
 * the consumer starts, so a nack always lands somewhere inspectable.
 */
async function assertDeadLetterTopology(uri: string, queue: string) {
  const connection = await amqplib.connect(uri);
  try {
    const channel = await connection.createChannel();
    try {
      await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', {
        durable: true,
      });
      await channel.assertQueue(`${queue}.dlq`, { durable: true });
      // Dead-lettered messages keep their original routing key (the queue name).
      await channel.bindQueue(`${queue}.dlq`, DEAD_LETTER_EXCHANGE, queue);
    } finally {
      // Swallow close() failures: a PRECONDITION_FAILED from assertQueue already
      // closes the channel, and letting that rejection escape a `finally` would
      // mask the original, far more diagnostic error.
      await channel.close().catch(() => undefined);
    }
  } finally {
    // Without this, a failed assert leaks the connection on every boot retry.
    await connection.close().catch(() => undefined);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(BillingModule);
  const rmqService = app.get(RmqService);
  const config = app.get(ConfigService);

  await assertDeadLetterTopology(
    config.getOrThrow('RABBIT_MQ_URI'),
    config.getOrThrow('RABBIT_MQ_BILLING_QUEUE'),
  );

  app.connectMicroservice(rmqService.getOptions('BILLING'));

  // Without this, Nest never runs onModuleDestroy on SIGTERM and Prisma's pool
  // is torn down by process death rather than disconnected cleanly.
  app.enableShutdownHooks();

  await app.startAllMicroservices();
}

// An unhandled rejection here would dump a raw stack — which, if RABBIT_MQ_URI or
// DATABASE_URL ever carries embedded credentials, prints them to the container log.
bootstrap().catch((error) => {
  Logger.error(
    `Billing failed to start: ${error instanceof Error ? error.message : String(error)}`,
    'Bootstrap',
  );
  process.exit(1);
});
