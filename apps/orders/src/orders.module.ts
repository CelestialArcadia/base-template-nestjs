import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import Joi from 'joi';
import { HealthController } from './health.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderSchema } from './schemas/order.schema';
import { DbModule, RmqModule } from '@app/common';
import { BILLING_SERVICE } from './constants/services';
import { SearchModule } from '@app/common/search/search.module';
import { ObserverModule } from '@app/common/observers/observer.module';
import { SearchService } from '@app/common/search/search.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGO_ATLAS_DB_URI: Joi.string().required(),
        APP_PORT: Joi.number().required(),
        ELASTIC_SEARCH_URL: Joi.string().required(),
      }),
      envFilePath: 'apps/orders/.env',
    }),
    DbModule,
    MongooseModule.forFeature([{ name: 'Order', schema: OrderSchema }]),
    RmqModule.register({ name: BILLING_SERVICE }),
    SearchModule,
    ObserverModule,
  ],
  controllers: [HealthController, OrdersController],
  providers: [
    OrdersService,
    {
      provide: 'SearchServiceInterface',
      useClass: SearchService,
    },
  ],
})
export class OrdersModule {}
