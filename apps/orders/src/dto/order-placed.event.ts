/**
 * The message published to RabbitMQ on `place-order`.
 *
 * Deliberately NOT the same type as `OrderDto` (the HTTP request body): an event
 * needs a stable identity that the producer assigns, so that a consumer can
 * recognise a redelivery. `OrderDto` is a request; this is a fact that happened.
 */
export interface OrderPlacedEvent {
  /** Assigned by the producer. The consumer's idempotency key. */
  orderId: string;
  name: string;
  quantity: number;
  /** Minor units (cents). Money is never a float. */
  unitPriceCents: number;
  placedAt: string;
}
