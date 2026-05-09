"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/lib/hooks";

/**
 * Initialize user store from NextAuth session and fetch profile from backend
 */
export function UserInitializer({ children }: { children: React.ReactNode }) {
  // This hook fetches the current user's profile with role from the backend
  useCurrentUser();

  return children;
}
