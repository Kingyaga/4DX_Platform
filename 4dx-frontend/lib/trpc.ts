import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../src/server/routers/_app";

export const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
    }),
  ],
});