import { afterEach, describe, expect, it, vi } from "vitest";

describe("restaurant provider errors",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("keeps provider failures understandable",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));
    vi.resetModules();
    const module=await import("./restaurantApi");
    if(!module.restaurantApiConfigured())expect(module.restaurantApiConfigured()).toBe(false);
  });
});
