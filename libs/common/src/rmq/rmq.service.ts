/*
https://docs.nestjs.com/providers#services
*/

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext, Transport } from '@nestjs/microservices';

@Injectable()
export class RmqService {
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
      },
    };
  }

  ack(context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();
    channel.ack(originalMessage);
  }
}
