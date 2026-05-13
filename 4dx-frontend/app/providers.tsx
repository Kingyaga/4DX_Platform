"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, queryClient, trpcClient } from "@/lib/trpc";
import { UserInitializer } from "@/lib/components/user-initializer";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <SessionProvider>
          <UserInitializer>{children}</UserInitializer>
        </SessionProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}