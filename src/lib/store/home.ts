"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HOMES } from "@/data/homes";

interface HomeState {
  home: string;
  setHome: (home: string) => void;
}

export const useHomeStore = create<HomeState>()(
  persist(
    (set) => ({
      home: "Prague",
      setHome: (home) => set({ home: HOMES[home] ? home : "Prague" }),
    }),
    { name: "homeBase" }
  )
);
