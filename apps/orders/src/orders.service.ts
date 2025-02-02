import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BILLING_SERVICE } from './constants/services';
import { OrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(BILLING_SERVICE) private readonly billingClient: ClientProxy,
  ) {}

  placeOrder(order: OrderDto) {
    // Emit IF response not needed
    this.billingClient.emit('place-order', order);

    return { message: 'Order placed successfully' };
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
