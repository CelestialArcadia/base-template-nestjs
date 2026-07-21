import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  // Only ever called if `app.enableShutdownHooks()` ran — see billing/main.ts.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
