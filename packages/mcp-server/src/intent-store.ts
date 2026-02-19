export interface StoredIntent {
  intentId: string;
  toolName: string;
  amount: string;
  currency: "USDC" | "SOL";
  merchant: string;
  reference: string;
  createdAt: number;
  expiresAt: number;
  status: "created" | "verified" | "consumed";
  payer?: string;
}

const INTENT_TTL_MS = 15 * 60 * 1000;

export class IntentStore {
  private intents = new Map<string, StoredIntent>();

  create(
    toolName: string,
    amount: string,
    currency: "USDC" | "SOL",
    merchant: string,
  ): StoredIntent {
    const intentId = crypto.randomUUID();
    const reference = crypto.randomUUID();
    const now = Date.now();
    const intent: StoredIntent = {
      intentId,
      toolName,
      amount,
      currency,
      merchant,
      reference,
      createdAt: now,
      expiresAt: now + INTENT_TTL_MS,
      status: "created",
    };
    this.intents.set(intentId, intent);
    return intent;
  }

  get(intentId: string): StoredIntent | undefined {
    return this.intents.get(intentId);
  }

  markVerified(intentId: string, payer: string): void {
    const intent = this.intents.get(intentId);
    if (intent) {
      intent.status = "verified";
      intent.payer = payer;
    }
  }

  markConsumed(intentId: string): void {
    const intent = this.intents.get(intentId);
    if (intent) {
      intent.status = "consumed";
    }
  }
}
