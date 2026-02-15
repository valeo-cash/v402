/**
 * Structured error for v402 payment flow failures.
 */
export class V402PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: "INTENT_EXPIRED" | "PAYMENT_FAILED" | "RETRY_FAILED" | "INVALID_INTENT",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "V402PaymentError";
    Object.setPrototypeOf(this, V402PaymentError.prototype);
  }
}
