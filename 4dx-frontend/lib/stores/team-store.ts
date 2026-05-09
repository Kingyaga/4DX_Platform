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

export const useTeamStore = create<TeamStore>((set) => ({
  currentTeam: null,
  currentTeamSlug: null,
  myTeams: [],

  setCurrentTeam: (team: Team | null, slug?: string) => {
    set({
      currentTeam: team,
      currentTeamSlug: slug || team?.slug || null,
    });
  },

  setCurrentTeamSlug: (slug: string | null) => {
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
    set({
      currentTeam: null,
      currentTeamSlug: null,
      myTeams: [],
    });
  },
}));
