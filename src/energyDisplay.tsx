import { createContext, useContext, type ReactNode } from "react";
import { energyText } from "./domain/energy";
import type { EnergyUnit } from "./domain/types";

type EnergyDisplayContext = { unit: EnergyUnit; toggle: () => void };
const Context = createContext<EnergyDisplayContext>({ unit: "kcal", toggle: () => undefined });

export function EnergyDisplayProvider({ unit, toggle, children }: EnergyDisplayContext & { children: ReactNode }) {
  return <Context.Provider value={{ unit, toggle }}>{children}</Context.Provider>;
}

export function useEnergyDisplay() { return useContext(Context); }

export function EnergyText({ calories }: { calories: number }) {
  const { unit } = useEnergyDisplay();
  return <>{energyText(calories, unit)}</>;
}
