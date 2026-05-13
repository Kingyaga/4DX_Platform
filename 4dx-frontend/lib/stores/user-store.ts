/**
 * User Store
 * Manages the current logged-in user context
 */

import { create } from "zustand";
import type { User, UserRole } from "../types";

interface UserStore {
  user: User | null;
  orgSlug: string | null;
  userRole: UserRole | null;
  setUser: (user: User | null) => void;
  setOrgSlug: (slug: string | null) => void;
  setUserRole: (role: UserRole | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  orgSlug: null,
  userRole: null,

  setUser: (user: User | null) => {
    set({ user, userRole: user?.role || null });
  },

  setOrgSlug: (slug: string | null) => {
    set({ orgSlug: slug });
  },

  setUserRole: (role: UserRole | null) => {
    set({ userRole: role });
  },

  clearUser: () => {
    set({ user: null, orgSlug: null, userRole: null });
  },
}));
