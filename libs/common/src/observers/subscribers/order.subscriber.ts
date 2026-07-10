import { OrderElasticIndex } from '@app/common/search/search-index/product.elastic.index';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Order } from 'apps/orders/src/schemas/order.schema';

// TODO: This is an example of code using TypeORM.
// You should replace this with the code using Mongoose.
@Injectable()
export class OrderSubscriber implements EntitySubscriberInterface<Order> {
  constructor(
    @InjectConnection() readonly connection: Connection,
    private readonly orderEsIndex: OrderElasticIndex,
  ) {
    connection.subscribers.push(this);
  }

  public listenTo(): any {
    return Order;
  }

  public async afterInsert(event: InsertEvent<Order>): Promise<any> {
    return await this.orderEsIndex.insertOrderDocument(event.entity);
  }

  public async afterUpdate(event: UpdateEvent<Order>): Promise<any> {
    return await this.orderEsIndex.updateOrderDocument(event.entity);
  }
}
