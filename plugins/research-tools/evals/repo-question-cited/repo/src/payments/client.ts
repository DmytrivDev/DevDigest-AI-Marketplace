import { PaymentDeclinedError, PaymentRetryExhaustedError } from "./errors.js";

export interface ChargeRequest {
  orderId: string;
  amountCents: number;
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<{ chargeId: string }>;
}

const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

function maxRetries(): number {
  const raw = process.env.PAYMENT_MAX_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_RETRIES;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PaymentClient {
  constructor(private readonly gateway: PaymentGateway) {}

  async charge(request: ChargeRequest): Promise<{ chargeId: string }> {
    const retries = maxRetries();
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.gateway.charge(request);
      } catch (error) {
        if (error instanceof PaymentDeclinedError) throw error; // a decline is final
        lastError = error;
        if (attempt < retries) await sleep(BASE_DELAY_MS * 2 ** attempt);
      }
    }
    throw new PaymentRetryExhaustedError(retries + 1, lastError);
  }
}
