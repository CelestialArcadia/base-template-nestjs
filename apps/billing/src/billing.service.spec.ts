import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OrderPlacedEvent } from 'apps/orders/src/dto/order-placed.event';
import { BillingService } from './billing.service';
import { PrismaService } from './prisma/prisma.service';

const event: OrderPlacedEvent = {
  orderId: 'order-1',
  name: 'Widget',
  quantity: 3,
  unitPriceCents: 1250,
  placedAt: '2026-07-09T12:00:00.000Z',
};

/** Prisma reports the offending columns in `meta.target`. */
const uniqueViolation = (target: string[] | string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });

describe('BillingService.bill', () => {
  let service: BillingService;
  let create: jest.Mock;

  beforeEach(async () => {
    create = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: { invoice: { create } } },
      ],
    }).compile();

    service = moduleRef.get(BillingService);
  });

  it('issues one invoice, computing the amount in integer cents', async () => {
    create.mockResolvedValue({ id: 'inv-1', currency: 'EUR' });

    await service.bill(event);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        itemName: 'Widget',
        quantity: 3,
        amountCents: 3750, // 3 x 1250 — never a float
      },
    });
  });

  // The point of the whole design: RabbitMQ delivers at-least-once, so the
  // same event WILL arrive twice. The unique index is the guard; this proves
  // the service treats losing that race as success rather than erroring.
  it('swallows a duplicate delivery (unique violation on order_id)', async () => {
    create.mockRejectedValue(uniqueViolation(['order_id']));

    await expect(service.bill(event)).resolves.toBeUndefined();
  });

  it('accepts meta.target reported as a string rather than an array', async () => {
    create.mockRejectedValue(uniqueViolation('invoices_order_id_key'));

    await expect(service.bill(event)).resolves.toBeUndefined();
  });

  // Guards the trap: if a future migration adds another unique index, a
  // violation of THAT one must not be mislabelled "duplicate delivery" while
  // the order silently vanishes.
  it('rethrows a unique violation on a different constraint', async () => {
    create.mockRejectedValue(uniqueViolation(['invoice_number']));

    await expect(service.bill(event)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('rethrows any non-P2002 database error', async () => {
    create.mockRejectedValue(new Error('connection reset'));

    await expect(service.bill(event)).rejects.toThrow('connection reset');
  });

  // Isolates the `error.code === 'P2002'` half of the guard: a Prisma error of a
  // different code must rethrow even when meta.target happens to name order_id.
  it('rethrows a non-P2002 Prisma error even if meta.target names order_id', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
        meta: { target: ['order_id'] },
      }),
    );

    await expect(service.bill(event)).rejects.toThrow('Record not found');
  });

  // Isolates the `instanceof PrismaClientKnownRequestError` half: duck-typing on
  // `.code` would let any thrown object impersonate a duplicate delivery and
  // silently discard the order.
  it('rethrows a duck-typed object that merely looks like a P2002', async () => {
    const impostor = Object.assign(new Error('not a prisma error'), {
      code: 'P2002',
      meta: { target: ['order_id'] },
    });
    create.mockRejectedValue(impostor);

    await expect(service.bill(event)).rejects.toThrow('not a prisma error');
  });
});
