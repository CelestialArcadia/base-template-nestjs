/*
https://docs.nestjs.com/modules
*/

import { OrderElasticIndex } from '@app/common/search/search-index/product.elastic.index';
import { SearchService } from '@app/common/search/search.service';
import { Module } from '@nestjs/common';
import { OrderSubscriber } from './order.subscriber';

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: 'SearchServiceInterface',
      useClass: SearchService,
    },
    OrderElasticIndex,
    // TODO: This is an example of code using subscriber TypeORM.
    // You should replace this with the code using Mongoose.
    OrderSubscriber,
  ],
})
export class SubscriberModule {}
