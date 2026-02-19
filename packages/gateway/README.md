# @v402pay/gateway

Server-side gateway middleware for the v402 payment protocol — intent creation, policy enforcement, on-chain verification, and receipt issuance.

## Install

```bash
npm install @v402pay/gateway
```

## Usage

```typescript
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";

const ctx = createGatewayContext(process.env);
const fastify = Fastify();
await v402GatewayFastify(ctx, fastify);

fastify.post("/api/tool", async (req, reply) => {
  return reply.send({ result: "Hello from paid tool" });
});
```

Supports Express, Fastify, and Next.js middleware.

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)
- [Protocol spec](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
