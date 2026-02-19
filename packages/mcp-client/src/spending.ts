import type { SpendingPolicy, PaymentRecord } from "./types.js";

export class SpendingTracker {
  private policy: SpendingPolicy;
  private payments: PaymentRecord[] = [];

  constructor(policy?: SpendingPolicy) {
    this.policy = policy ?? {};
  }

  checkPolicy(
    amount: number,
    toolName?: string,
    merchant?: string,
  ): { allowed: boolean; reason?: string } {
    if (this.policy.perCallCap != null && amount > this.policy.perCallCap) {
      return {
        allowed: false,
        reason: `Amount ${amount} exceeds per-call cap ${this.policy.perCallCap}`,
      };
    }

    if (this.policy.dailyCap != null) {
      const todaySpend = this.getTodaySpend();
      if (todaySpend + amount > this.policy.dailyCap) {
        return {
          allowed: false,
          reason: `Would exceed daily cap ${this.policy.dailyCap} (already spent: ${todaySpend})`,
        };
      }
    }

    if (
      this.policy.allowedTools &&
      this.policy.allowedTools.length > 0 &&
      toolName
    ) {
      if (!this.policy.allowedTools.includes(toolName)) {
        return {
          allowed: false,
          reason: `Tool "${toolName}" not in allowed list`,
        };
      }
    }

    if (
      this.policy.allowedMerchants &&
      this.policy.allowedMerchants.length > 0 &&
      merchant
    ) {
      if (!this.policy.allowedMerchants.includes(merchant)) {
        return {
          allowed: false,
          reason: `Merchant "${merchant}" not in allowed list`,
        };
      }
    }

    return { allowed: true };
  }

  recordPayment(record: PaymentRecord): void {
    this.payments.push(record);
  }

  getTodaySpend(): number {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const startMs = todayStart.getTime();
    return this.payments
      .filter((p) => p.timestamp >= startMs)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  remainingBudget(): number {
    if (this.policy.dailyCap == null) return Infinity;
    return Math.max(0, this.policy.dailyCap - this.getTodaySpend());
  }

  getPaymentHistory(): PaymentRecord[] {
    return [...this.payments];
  }
}
