import { SearchServiceInterface } from '@app/common/search/interface/search-service.interface';
import { OrderSearchObject } from '@app/common/search/model/product-search.model';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { BILLING_SERVICE } from './constants/services';
import { OrderPlacedEvent } from './dto/order-placed.event';
import { OrderDto } from './dto/order.dto';
import { OrdersServiceInterface } from './orders-service.interface';

@Injectable()
export class OrdersService implements OrdersServiceInterface {
  constructor(
    @Inject(BILLING_SERVICE) private readonly billingClient: ClientProxy,
    @Inject('SearchServiceInterface')
    private readonly searchService: SearchServiceInterface<any>,
  ) {}

  async search(q: any): Promise<any> {
    const data = OrderSearchObject.searchObject(q);
    return await this.searchService.searchIndex(data);
  }

  placeOrder(order: OrderDto) {
    // The producer assigns the identity. Billing keys idempotency off this id,
    // so it must be generated exactly once — here — and not by the consumer.
    const event: OrderPlacedEvent = {
      orderId: randomUUID(),
      name: order.name,
      quantity: order.quantity,
      unitPriceCents: order.unitPriceCents,
      placedAt: new Date().toISOString(),
    };

    // Emit IF response not needed
    this.billingClient.emit('place-order', event);

    return { message: 'Order placed successfully', orderId: event.orderId };
  }

  getOrders() {
    // Send IF response is necessary
    return this.billingClient.send({ cmd: 'fetch-orders' }, {});
  }

  // async startTransaction() {
  //   const session = await this.connection.startSession();
  //   session.startTransaction();
  //   return session;
  // }
}
