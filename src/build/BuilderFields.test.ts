import { describe, expect, it } from "vitest";
import { angleDegreesInputToRad, formatAngleDegrees } from "./BuilderFields";

describe("builder angle field helpers", () => {
  it("formats radians as a positive 0-359 degree value", () => {
    expect(formatAngleDegrees(0)).toBe("0");
    expect(formatAngleDegrees(Math.PI / 2)).toBe("90");
    expect(formatAngleDegrees(-Math.PI / 2)).toBe("270");
    expect(formatAngleDegrees(Math.PI * 2 + Math.PI / 4)).toBe("45");
  });

  it("accepts typed degree strings and normalizes them to radians", () => {
    expect(angleDegreesInputToRad(" 450° ")).toBeCloseTo(Math.PI / 2);
    expect(angleDegreesInputToRad("-90")).toBeCloseTo((Math.PI * 3) / 2);
    expect(angleDegreesInputToRad("12.5")).toBeCloseTo((12.5 * Math.PI) / 180);
    expect(angleDegreesInputToRad("")).toBeNull();
    expect(angleDegreesInputToRad("not a number")).toBeNull();
  });
});
