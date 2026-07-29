import { useState } from "react";
import { caloriesFromEnergy, energyInputValue } from "./domain/energy";
import type { EnergyUnit } from "./domain/types";
import { useEnergyDisplay } from "./energyDisplay";

export function EnergyInput({ calories, onCaloriesChange }: {
  calories?: number;
  onCaloriesChange: (calories?: number) => void;
}) {
  const { unit: preferredUnit } = useEnergyDisplay();
  const [unit, setUnit] = useState<EnergyUnit>(preferredUnit);
  const [text, setText] = useState(() => calories === undefined ? "" : String(energyInputValue(calories, preferredUnit)));

  const switchUnit = () => {
    const next: EnergyUnit = unit === "kcal" ? "kJ" : "kcal";
    const entered = Number(text);
    setText(text === "" || !Number.isFinite(entered) ? text : String(energyInputValue(caloriesFromEnergy(entered, unit), next)));
    setUnit(next);
  };

  return <div className="energy-entry-control">
    <input aria-label={`Energy in ${unit === "kcal" ? "kilocalories" : "kilojoules"}`} type="number" min="0" step="any" inputMode="decimal" value={text} onChange={(event) => {
      const next = event.target.value;
      setText(next);
      const entered = Number(next);
      onCaloriesChange(next === "" || !Number.isFinite(entered) ? undefined : caloriesFromEnergy(entered, unit));
    }}/>
    <button className="energy-entry-unit" data-unit={unit} type="button" onClick={switchUnit} aria-label={`Energy unit ${unit}. Switch to ${unit === "kcal" ? "kilojoules" : "kilocalories"}`}>{unit}</button>
  </div>;
}
