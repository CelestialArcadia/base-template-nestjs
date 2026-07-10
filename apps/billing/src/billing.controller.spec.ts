import { RmqService } from '@app/common';
import { Test } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { OrderPlacedEvent } from 'apps/orders/src/dto/order-placed.event';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

const event: OrderPlacedEvent = {
  orderId: 'order-1',
  name: 'Widget',
  quantity: 3,
  unitPriceCents: 1250,
  placedAt: '2026-07-09T12:00:00.000Z',
};

describe('BillingController.handlePlacedOrder', () => {
  let controller: BillingController;
  let bill: jest.Mock;
  let ack: jest.Mock;
  let nack: jest.Mock;
  const context = {} as RmqContext;

  beforeEach(async () => {
    bill = jest.fn();
    ack = jest.fn();
    nack = jest.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: { bill } },
        { provide: RmqService, useValue: { ack, nack } },
      ],
    }).compile();

    controller = moduleRef.get(BillingController);
  });

  it('acks only after the invoice is written', async () => {
    const order: string[] = [];
    bill.mockImplementation(async () => {
      order.push('bill');
    });
    ack.mockImplementation(() => order.push('ack'));

    await controller.handlePlacedOrder(event, context);

    // Acking a message whose invoice was never written silently drops the order.
    expect(order).toEqual(['bill', 'ack']);
    expect(nack).not.toHaveBeenCalled();
  });

  // Not acking is NOT nacking: an unacked delivery parks on the live channel,
  // invisible and never retried. A failure must be terminated explicitly.
  it('dead-letters a failed order instead of acking or stalling it', async () => {
    bill.mockRejectedValue(new Error('check constraint violated'));

    await controller.handlePlacedOrder(event, context);

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledTimes(1);
    // requeue: false — a deterministic failure would otherwise spin hot.
    expect(nack).toHaveBeenCalledWith(context, false);
  });

  it('does not let a handler failure escape into Nest (which would log a raw stack)', async () => {
    bill.mockRejectedValue(new Error('boom'));

    await expect(
      controller.handlePlacedOrder(event, context),
    ).resolves.toBeUndefined();
  });
});
