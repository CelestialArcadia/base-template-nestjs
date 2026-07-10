/*
https://docs.nestjs.com/modules
*/

import { DynamicModule, Module } from '@nestjs/common';
import { QUEUE_OPTIONS, RmqService } from './rmq.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

interface RmqModuleOptions {
  name: string;
}
@Module({
  imports: [],
  controllers: [],
  providers: [RmqService],
  exports: [RmqService],
})
export class RmqModule {
  static register({ name }: RmqModuleOptions): DynamicModule {
    return {
      module: RmqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: name,
            useFactory: (configService: ConfigService) => ({
              transport: Transport.RMQ,
              options: {
                urls: [configService.getOrThrow<string>('RABBIT_MQ_URI')],
                queue: configService.getOrThrow(`RABBIT_MQ_${name}_QUEUE`),
                // Must match the consumer's declaration exactly — see QUEUE_OPTIONS.
                queueOptions: QUEUE_OPTIONS,
              },
            }),
            inject: [ConfigService],
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
