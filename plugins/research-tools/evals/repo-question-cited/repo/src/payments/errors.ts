export class PaymentDeclinedError extends Error {
  constructor(public readonly reason: string) {
    super(`payment declined: ${reason}`);
  }
}

export class PaymentRetryExhaustedError extends Error {
  constructor(public readonly attempts: number, public readonly lastError: unknown) {
    super(`payment failed after ${attempts} attempts`);
  }
}
