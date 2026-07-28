import { describe,expect,it } from "vitest";
import { defaultSettings,validateSettings } from "./settings";
import type { AppSettings } from "./types";
describe("settings",()=>{
  it("accepts valid defaults",()=>expect(validateSettings(defaultSettings)).toEqual(defaultSettings));
  it("rejects invalid preference values",()=>{
    expect(()=>validateSettings({...defaultSettings,appearance:"sepia" as AppSettings["appearance"]})).toThrow(/appearance/);
    expect(()=>validateSettings({...defaultSettings,accentColour:"red"})).toThrow(/colour/);
    expect(()=>validateSettings({...defaultSettings,weekStartsOn:2 as AppSettings["weekStartsOn"]})).toThrow(/first day/);
    expect(()=>validateSettings({...defaultSettings,weightUnit:"stone" as AppSettings["weightUnit"]})).toThrow(/weight unit/);
    expect(()=>validateSettings({...defaultSettings,energyUnit:"joules" as AppSettings["energyUnit"]})).toThrow(/energy unit/);
    expect(()=>validateSettings({...defaultSettings,targets:{...defaultSettings.targets,calories:-1}})).toThrow(/calories/);
  });
});
