import { describe, expect, it } from "vitest";
import { monthGrid } from "./calendar";

describe("calendar grid",()=>{it("builds complete Monday-first weeks",()=>{const days=monthGrid(new Date(2026,6,15),1);expect(days[0]?.getDay()).toBe(1);expect(days.at(-1)?.getDay()).toBe(0);expect(days.length%7).toBe(0);expect(days.some(d=>d.getDate()===31&&d.getMonth()===6)).toBe(true)});it("supports Sunday-first weeks",()=>expect(monthGrid(new Date(2026,6,15),0)[0]?.getDay()).toBe(0))});
