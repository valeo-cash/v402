/**
 * Safe decimal-to-atomic-units conversion for financial amounts.
 * Avoids parseFloat lossiness for large or precise values.
 *
 * @param amount - Decimal string (e.g. "0.001" or "100.50")
 * @param decimals - Number of fractional digits (e.g. 9 for SOL, 6 for USDC)
 * @returns Atomic units as bigint (e.g. lamports or token base units)
 */
export function parseAmount(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(padded || "0");
}
