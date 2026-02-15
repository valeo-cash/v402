/**
 * Memo program: require exactly one instruction with content "v402:<reference>".
 * Memo program id (mainnet): MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
 */

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

const V402_PREFIX = "v402:";

export function extractMemoReference(memoInstructionData: string): string | null {
  const trimmed = memoInstructionData.trim();
  if (!trimmed.startsWith(V402_PREFIX)) return null;
  return trimmed.slice(V402_PREFIX.length);
}

function decodeMemoData(data: string): string {
  const trimmed = data.trim();
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
    try {
      return Buffer.from(trimmed, "base64").toString("utf8");
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/**
 * Check that the transaction contains a Memo instruction with exactly "v402:<reference>".
 * Returns true only if at least one memo instruction's data equals (after trim/decode) "v402:" + reference.
 */
export function hasV402Memo(
  memoInstructions: { data: string }[],
  reference: string
): boolean {
  const expected = V402_PREFIX + reference;
  return memoInstructions.some((m) => {
    const decoded = decodeMemoData(m.data);
    return decoded.trim() === expected;
  });
}
