import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

export const trpc = createTRPCReact<any>() as any;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,
      refetchInterval: 30 * 1000,
      refetchOnWindowFocus: true,
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: async (input, init) => {
        return fetch(input, { ...init, credentials: "include" });
      },
    }),
  ],
});
