import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { copyTextToClipboard } from "../src/utils/clipboard.js";

describe("clipboard utils", () => {
  it("copies text when the clipboard API is available", async () => {
    let copiedText = "";
    const result = await copyTextToClipboard("BarberOS", {
      writeText: async (text) => {
        copiedText = text;
      },
    });

    assert.equal(result, true);
    assert.equal(copiedText, "BarberOS");
  });

  it("returns false when clipboard is unavailable or blocked", async () => {
    assert.equal(await copyTextToClipboard("BarberOS", null), false);
    assert.equal(
      await copyTextToClipboard("BarberOS", {
        writeText: async () => {
          throw new Error("blocked");
        },
      }),
      false
    );
  });
});
