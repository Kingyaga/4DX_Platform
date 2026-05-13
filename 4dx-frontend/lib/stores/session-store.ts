/**
 * Session Store
 * Manages current week's sessions for the team
 */

import { create } from "zustand";
import type { WeeklySession } from "../types";

interface SessionStore {
  currentSessions: WeeklySession[];
  activeSessionId: string | null;
  setCurrentSessions: (sessions: WeeklySession[]) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateSession: (sessionId: string, updates: Partial<WeeklySession>) => void;
  clearSessions: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentSessions: [],
  activeSessionId: null,

  setCurrentSessions: (sessions: WeeklySession[]) => {
    set({ currentSessions: sessions });
  },

  setActiveSession: (sessionId: string | null) => {
    set({ activeSessionId: sessionId });
  },

  updateSession: (sessionId: string, updates: Partial<WeeklySession>) => {
    set((state) => ({
      currentSessions: state.currentSessions.map((session) =>
        session.id === sessionId ? { ...session, ...updates } : session
      ),
    }));
  },

  clearSessions: () => {
    set({
      currentSessions: [],
      activeSessionId: null,
    });
  },
}));
