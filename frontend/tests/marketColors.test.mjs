import test from "node:test";
import assert from "node:assert/strict";
import { marketColors } from "../src/lib/marketColors.ts";

test("bullish and bearish chart colors are distinct green/red in both themes", () => {
  const dark = marketColors("dark");
  const light = marketColors("light");

  assert.deepEqual(dark, { up: "#18c67a", down: "#e05b52" });
  assert.deepEqual(light, { up: "#0f8f57", down: "#c84b45" });
  assert.notEqual(dark.up, dark.down);
  assert.notEqual(light.up, light.down);
});
