import { create } from "zustand";

type ApiPanel = "overview" | "admin";

type UiState = {
  activePanel: ApiPanel;
  showRawJson: boolean;
  setActivePanel: (panel: ApiPanel) => void;
  toggleRawJson: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  activePanel: "overview",
  showRawJson: true,
  setActivePanel: (activePanel) => set({ activePanel }),
  toggleRawJson: () => set((state) => ({ showRawJson: !state.showRawJson })),
}));
