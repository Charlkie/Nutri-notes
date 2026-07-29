import { describe, expect, it } from "vitest";
import { formatFoodQuantity } from "./foodQuantity";

describe("food quantity labels", () => {
  it("formats one serving as one serve", () => expect(formatFoodQuantity(1, "serving")).toBe("1 serve"));
  it("formats multiple servings as serves", () => expect(formatFoodQuantity(2, "serving")).toBe("2 serves"));
  it("does not pluralise measurement abbreviations", () => expect(formatFoodQuantity(2, "g")).toBe("2 g"));
});
