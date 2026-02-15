import { createHash } from "crypto";
import * as ed25519 from "@noble/ed25519";

// @noble/ed25519 requires sha512Sync in Node for sync sign/verify. Set it before any test loads core.
if (ed25519.etc && typeof createHash === "function") {
  ed25519.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
    const totalLen = messages.reduce((s, a) => s + a.length, 0);
    const buf = new Uint8Array(totalLen);
    let off = 0;
    for (const a of messages) {
      buf.set(a, off);
      off += a.length;
    }
    return new Uint8Array(createHash("sha512").update(Buffer.from(buf)).digest());
  };
}
