import { RmqService } from '@app/common';
import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrderDto } from 'apps/orders/src/dto/order.dto';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly rmqservice: RmqService,
  ) {}

  @EventPattern('place-order')
  async handlePlacedOrder(
    @Payload() data: OrderDto,
    @Ctx() context: RmqContext,
  ) {
    this.billingService.bill(data);
    this.rmqservice.ack(context);
  }
}
