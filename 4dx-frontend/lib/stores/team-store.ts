/**
 * Team Store
 * Manages current team context and team list
 */

import { create } from "zustand";
import type { Team, MyTeamsResponse } from "../types";

interface TeamStore {
  currentTeam: Team | null;
  currentTeamSlug: string | null;
  myTeams: MyTeamsResponse[];
  setCurrentTeam: (team: Team | null, slug?: string) => void;
  setCurrentTeamSlug: (slug: string | null) => void;
  setMyTeams: (teams: MyTeamsResponse[]) => void;
  addTeam: (team: MyTeamsResponse) => void;
  clearTeam: () => void;
}

const getInitialTeamSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("currentTeamSlug");
};

export const useTeamStore = create<TeamStore>((set) => ({
  currentTeam: null,
  currentTeamSlug: getInitialTeamSlug(),
  myTeams: [],

  setCurrentTeam: (team: Team | null, slug?: string) => {
    const currentTeamSlug = slug || team?.slug || null;
    if (typeof window !== "undefined") {
      if (currentTeamSlug) {
        window.localStorage.setItem("currentTeamSlug", currentTeamSlug);
      } else {
        window.localStorage.removeItem("currentTeamSlug");
      }
    }
    set({
      currentTeam: team,
      currentTeamSlug,
    });
  },

  setCurrentTeamSlug: (slug: string | null) => {
    if (typeof window !== "undefined") {
      if (slug) {
        window.localStorage.setItem("currentTeamSlug", slug);
      } else {
        window.localStorage.removeItem("currentTeamSlug");
      }
    }
    set({ currentTeamSlug: slug });
  },

  setMyTeams: (teams: MyTeamsResponse[]) => {
    set({ myTeams: teams });
  },

  addTeam: (team: MyTeamsResponse) => {
    set((state) => ({
      myTeams: [...state.myTeams, team],
    }));
  },

  clearTeam: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("currentTeamSlug");
    }
    set({
      currentTeam: null,
      currentTeamSlug: null,
      myTeams: [],
    });
  },
}));
