/*
https://docs.nestjs.com/providers#services
*/

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext, Transport } from '@nestjs/microservices';
import { MAX_LOGGED_ERROR_LENGTH, sanitizeForLog } from '../logging/sanitize';

/**
 * Poison messages are routed here instead of being requeued (which would spin
 * hot) or discarded (which would silently lose an order). A direct exchange:
 * dead-lettered messages keep their original routing key — the queue name — so
 * `billing` failures land in whatever queue is bound with key `billing`.
 */
export const DEAD_LETTER_EXCHANGE = 'dlx';

/**
 * ⚠️ Two-part contract for anyone consuming through `getOptions()`:
 *
 * 1. These options must be identical on the producer's `ClientProxy` and the
 *    consumer's server. Whichever connects first declares the queue, and
 *    RabbitMQ rejects a later declaration whose arguments differ
 *    (`PRECONDITION_FAILED`).
 *
 * 2. **Every consumer must declare its own `<queue>.dlq` bound to `dlx` on the
 *    queue's routing key.** These options dead-letter to `dlx` unconditionally,
 *    and a dead-letter exchange with no queue bound for that routing key
 *    *silently discards* the message. See `apps/billing/src/main.ts`
 *    (`assertDeadLetterTopology`) for the pattern to copy.
 */
export const QUEUE_OPTIONS = Object.freeze({
  durable: true,
  arguments: Object.freeze({
    'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
  }),
});

@Injectable()
export class RmqService {
  private readonly logger = new Logger(RmqService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Retrieves the options for the RabbitMQ connection.
   * @param queue - The name of the queue to connect to.
   * @param noAck - Whether to automatically acknowledge messages. Default is false.
   * @returns An object containing connection options.
   */
  getOptions(queue: string, noAck = false) {
    return {
      transport: Transport.RMQ,
      options: {
        urls: [this.configService.getOrThrow('RABBIT_MQ_URI')],
        queue: this.configService.getOrThrow(`RABBIT_MQ_${queue}_QUEUE`),
        noAck,
        persistent: true,
        queueOptions: QUEUE_OPTIONS,
      },
    };
  }

  ack(context: RmqContext) {
    this.settle(context, (channel, message) => channel.ack(message), 'ack');
  }

  /**
   * Rejects a message. With `requeue: false` (the default) RabbitMQ hands it to
   * the dead-letter exchange rather than redelivering it forever.
   *
   * Note: *not* acking is NOT equivalent to nacking. An unacked message stays
   * parked on the live channel — invisible in the ready count, never retried —
   * until the connection drops. Always terminate a delivery explicitly.
   */
  nack(context: RmqContext, requeue = false) {
    this.settle(
      context,
      (channel, message) => channel.nack(message, false, requeue),
      'nack',
    );
  }

  /**
   * `RmqContext` captures the raw channel at delivery time. If the connection
   * reconnected while the handler was running, that channel is closed and
   * amqplib throws `IllegalOperationError` synchronously here.
   *
   * Left unhandled, that escapes into Nest's `RpcExceptionsHandler`, which logs
   * the raw stack — defeating the sanitization this service exists to enforce.
   * Swallow it: the broker already requeues deliveries orphaned by a closed
   * channel, so the message is not lost, and there is nothing to retry against
   * a dead channel.
   */
  private settle(
    context: RmqContext,
    action: (channel: any, message: any) => void,
    operation: string,
  ) {
    try {
      action(context.getChannelRef(), context.getMessage());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to ${operation} message (channel likely closed by a reconnect); ` +
          `the broker will redeliver it: ${sanitizeForLog(reason, MAX_LOGGED_ERROR_LENGTH)}`,
      );
    }
  }
}
