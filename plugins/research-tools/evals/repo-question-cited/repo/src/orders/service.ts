import { PaymentClient } from "../payments/client.js";
import { PaymentDeclinedError, PaymentRetryExhaustedError } from "../payments/errors.js";

export type OrderStatus = "pending" | "paid" | "declined" | "payment_failed";

export interface OrderRepository {
  setStatus(orderId: string, status: OrderStatus, note?: string): Promise<void>;
}

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentClient,
  ) {}

  async pay(orderId: string, amountCents: number): Promise<OrderStatus> {
    try {
      await this.payments.charge({ orderId, amountCents });
      await this.orders.setStatus(orderId, "paid");
      return "paid";
    } catch (error) {
      if (error instanceof PaymentDeclinedError) {
        await this.orders.setStatus(orderId, "declined", error.reason);
        return "declined";
      }
      if (error instanceof PaymentRetryExhaustedError) {
        await this.orders.setStatus(orderId, "payment_failed", error.message);
        return "payment_failed";
      }
      throw error;
    }
  }
}
