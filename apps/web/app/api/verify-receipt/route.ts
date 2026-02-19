import { NextResponse } from "next/server";
import { createHash } from "crypto";

async function getEd25519() {
  const ed = await import("@noble/ed25519");
  if (
    (ed as unknown as { etc?: { sha512Sync?: unknown } }).etc &&
    typeof (ed as unknown as { etc: { sha512Sync?: unknown } }).etc
      .sha512Sync !== "function"
  ) {
    (
      ed as unknown as {
        etc: { sha512Sync: (...m: Uint8Array[]) => Uint8Array };
      }
    ).etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
      const totalLen = messages.reduce((s, a) => s + a.length, 0);
      const buf = new Uint8Array(totalLen);
      let off = 0;
      for (const a of messages) {
        buf.set(a, off);
        off += a.length;
      }
      return new Uint8Array(createHash("sha512").update(buf).digest());
    };
  }
  return ed;
}

function stableSortedStringify(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

export async function POST(request: Request) {
  try {
    const receipt = (await request.json()) as Record<string, unknown>;

    if (receipt.version === 2) {
      return verifyV2(receipt);
    }

    return verifyV1(receipt);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Failed to process receipt" },
      { status: 400 },
    );
  }
}

async function verifyV2(receipt: Record<string, unknown>) {
  const signature = receipt.signature as string | undefined;
  const signerPubkey = receipt.signer_pubkey as string | undefined;
  const receiptHash = receipt.receipt_hash as string | undefined;

  if (!signature || !signerPubkey || !receiptHash) {
    return NextResponse.json({
      valid: false,
      error: "Missing signature, signer_pubkey, or receipt_hash",
    });
  }

  const payloadFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(receipt)) {
    if (k !== "signature" && k !== "signer_pubkey" && k !== "receipt_hash") {
      payloadFields[k] = v;
    }
  }
  const canonical = stableSortedStringify(payloadFields);
  const computedHash = createHash("sha256").update(canonical, "utf8").digest("hex");
  const hashValid = computedHash === receiptHash;

  let sigValid = false;
  try {
    const ed = await getEd25519();
    const sigBytes = Buffer.from(signature, "base64");
    const hashBytes = Buffer.from(receiptHash, "hex");
    const keyBytes = Buffer.from(signerPubkey, "hex");

    if (keyBytes.length === 32) {
      const result = ed.verify(sigBytes, hashBytes, keyBytes);
      sigValid =
        typeof result === "boolean"
          ? result
          : await (result as unknown as Promise<boolean>);
    }
  } catch {
    sigValid = false;
  }

  return NextResponse.json({
    valid: hashValid && sigValid,
    hashValid,
    sigValid,
  });
}

async function verifyV1(receipt: Record<string, unknown>) {
  const CANONICAL_KEYS = [
    "receiptId",
    "intentId",
    "toolId",
    "requestHash",
    "responseHash",
    "txSig",
    "payer",
    "merchant",
    "timestamp",
  ];

  const signature = (receipt.signature as string) ?? (receipt.receiptSignature as string);
  const publicKey = (receipt.signer_pubkey as string) ?? (receipt.signerPubkey as string);

  if (!signature || !publicKey) {
    return NextResponse.json({
      valid: false,
      error: "Missing signature or public key field",
    });
  }

  const ordered: Record<string, string> = {};
  for (const k of CANONICAL_KEYS) {
    if (receipt[k] !== undefined) ordered[k] = String(receipt[k]);
  }
  const canonical = stableSortedStringify(ordered);

  let sigValid = false;
  try {
    const ed = await getEd25519();
    const msgBuf = Buffer.from(canonical, "utf8");
    const sigBuf = Buffer.from(signature, "base64");
    const keyBuf = Buffer.from(publicKey, "hex");

    if (keyBuf.length === 32) {
      const result = ed.verify(sigBuf, msgBuf, keyBuf);
      sigValid =
        typeof result === "boolean"
          ? result
          : await (result as unknown as Promise<boolean>);
    }
  } catch {
    sigValid = false;
  }

  return NextResponse.json({ valid: sigValid, sigValid });
}
