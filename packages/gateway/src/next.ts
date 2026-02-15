/**
 * Next.js App Router integration. Import from @v402pay/gateway/next
 * so the main gateway bundle does not pull in next/server.
 */
export { withV402Gateway } from "./middleware/next.js";
export type { NextRouteHandler } from "./middleware/next.js";
