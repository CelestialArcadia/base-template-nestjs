import { Injectable, Logger } from '@nestjs/common';
import { OrderDto } from 'apps/orders/src/dto/order.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  bill(order: OrderDto) {
    this.logger.log(`Billing order: ${JSON.stringify(order)}`);
  }
}
