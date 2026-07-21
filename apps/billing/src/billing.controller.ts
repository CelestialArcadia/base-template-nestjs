import { MAX_LOGGED_ERROR_LENGTH, RmqService, sanitizeForLog } from '@app/common';
import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrderPlacedEvent } from 'apps/orders/src/dto/order-placed.event';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly rmqservice: RmqService,
  ) {}

  @EventPattern('place-order')
  async handlePlacedOrder(
    @Payload() data: OrderPlacedEvent,
    @Ctx() context: RmqContext,
  ) {
    try {
      // Await before acking: acking a message whose invoice was never written
      // would silently drop the order.
      await this.billingService.bill(data);
      this.rmqservice.ack(context);
    } catch (error) {
      // Don't requeue — a message that fails once on a deterministic error
      // (bad payload, constraint violation) fails forever and would spin hot.
      // Don't just skip the ack either: that parks it on the channel invisibly.
      // Nack it to the dead-letter queue, where it can be inspected and replayed.
      //
      // Log the message, never the stack: some driver errors embed the
      // credentialed connection string, and this line ends up in `docker logs`.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to bill order ${sanitizeForLog(data?.orderId)} — dead-lettering: ` +
          sanitizeForLog(reason, MAX_LOGGED_ERROR_LENGTH),
      );
      this.rmqservice.nack(context, false);
    }
  }
}
