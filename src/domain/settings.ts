import type { AppSettings } from "./types";

export const defaultSettings:AppSettings={appearance:"dark",accentColour:"#b7f36b",weekStartsOn:1,copyConsumedState:"reset",weightUnit:"kg",energyUnit:"kcal",targets:{calories:2200,protein:160,carbohydrates:240,fat:70}};
export function validateSettings(settings:AppSettings):AppSettings {
  if (!["system", "light", "dark"].includes(settings.appearance)) throw new Error("Choose a valid appearance");
  if (!/^#[0-9a-f]{6}$/i.test(settings.accentColour)) throw new Error("Choose a valid accent colour");
  if (settings.weekStartsOn !== 0 && settings.weekStartsOn !== 1) throw new Error("Choose a valid first day of the week");
  if (!["reset", "preserve"].includes(settings.copyConsumedState)) throw new Error("Choose a valid copy behavior");
  if (!["kg", "lb"].includes(settings.weightUnit)) throw new Error("Choose a valid weight unit");
  if (!["kcal", "kJ"].includes(settings.energyUnit)) throw new Error("Choose a valid energy unit");
  for (const [label,value] of Object.entries(settings.targets)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} target must be non-negative`);
  }
  return settings;
}
