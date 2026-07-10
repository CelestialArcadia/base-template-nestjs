import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderPlacedEvent } from 'apps/orders/src/dto/order-placed.event';
import { PrismaService } from './prisma/prisma.service';

/** Prisma's error code for a unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * The one unique constraint whose violation means "already processed."
 * Checked explicitly: if a future migration adds another unique index, a
 * violation of *that* one must not be silently swallowed as a duplicate.
 */
const ORDER_ID_CONSTRAINT = 'order_id';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues exactly one invoice per order, even if RabbitMQ delivers the same
   * event twice. At-least-once delivery makes duplicates a certainty, not an
   * edge case, so the unique index on `order_id` — not this code — is what
   * makes the operation safe. We race, we lose, we treat losing as success.
   */
  async bill(event: OrderPlacedEvent): Promise<void> {
    const amountCents = event.quantity * event.unitPriceCents;

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          orderId: event.orderId,
          itemName: event.name,
          quantity: event.quantity,
          amountCents,
        },
      });

      this.logger.log(
        `Invoice ${invoice.id} issued for order ${event.orderId} — ` +
          `${event.quantity} x ${event.name} = ${amountCents} ${invoice.currency} cents`,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION &&
        this.isOrderIdViolation(error)
      ) {
        this.logger.warn(
          `Order ${event.orderId} already invoiced — duplicate delivery ignored`,
        );
        return;
      }
      throw error;
    }
  }

  /** Prisma reports the offending columns in `meta.target` (array or string). */
  private isOrderIdViolation(
    error: Prisma.PrismaClientKnownRequestError,
  ): boolean {
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes(ORDER_ID_CONSTRAINT);
    return typeof target === 'string' && target.includes(ORDER_ID_CONSTRAINT);
  }
}
