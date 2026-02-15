/**
 * Canonical tool metadata payload for signing and verification.
 * Both signing (webapp) and verification (gateway) must use this same shape.
 */
import { stableStringify } from "./canonical.js";

export type ToolMetadataInput = {
  toolId: string;
  name: string;
  description: string;
  baseUrl: string;
  pathPattern: string;
  pricingModel: Record<string, unknown>;
  acceptedCurrency: string;
  merchantWallet: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Build the canonical string used for tool metadata Ed25519 signing/verification.
 * Must be used by both signers and verifiers.
 */
export function canonicalToolMetadata(input: ToolMetadataInput): string {
  return stableStringify({
    toolId: input.toolId,
    name: input.name,
    description: input.description ?? "",
    baseUrl: input.baseUrl,
    pathPattern: input.pathPattern,
    pricingModel: input.pricingModel,
    acceptedCurrency: input.acceptedCurrency,
    merchantWallet: input.merchantWallet,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}
