-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- Enforced by the database, not by application code: an invoice for zero items
-- or zero money is a bug, and no code path should be trusted to prevent it.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_cents_positive" CHECK ("amount_cents" > 0);

-- CreateIndex: the idempotency guard for at-least-once RabbitMQ delivery.
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");
