/**
 * Real merchant tool server using @v402pay/gateway (Fastify).
 * Run: node merchant-server.mjs
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOLANA_RPC_URL, USDC_MINT, ENCRYPTION_KEY
 */
import Fastify from "fastify";
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";

const ctx = createGatewayContext(process.env);
const fastify = Fastify({ logger: true });
await v402GatewayFastify(ctx, fastify);
fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  req.rawBody = body;
  done(null, body);
});
fastify.post("/pay", async (request, reply) => {
  return reply.send({ ok: true, ts: new Date().toISOString() });
});
await fastify.listen({ port: 4040, host: "0.0.0.0" });
console.log("Merchant server on http://localhost:4040");
