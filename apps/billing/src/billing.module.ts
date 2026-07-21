import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { RmqModule } from '@app/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    RmqModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_BILLING_QUEUE: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        // Billing owns no Mongo data, but the `@app/common` barrel calls
        // `CrudifyModule.forRoot({ uri: process.env.MONGO_ATLAS_DB_URI })` at
        // module-load time, so importing RmqService from it eagerly opens a
        // Mongo connection. Unset => it dials localhost and crash-loops.
        // Removing this requires refactoring db.module.ts to an async factory.
        MONGO_ATLAS_DB_URI: Joi.string().required(),
      }),
    }),
  ],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
