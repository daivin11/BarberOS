import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRequiredElementById } from "../src/utils/dom.js";

describe("DOM utils", () => {
  it("returns a required element when it exists", () => {
    const rootElement = { id: "root" };
    const documentRef = {
      getElementById: (elementId) => (elementId === "root" ? rootElement : null),
    };

    assert.equal(getRequiredElementById(documentRef, "root"), rootElement);
  });

  it("throws a clear error when a required element is missing", () => {
    assert.throws(
      () =>
        getRequiredElementById(
          {
            getElementById: () => null,
          },
          "root"
        ),
      /Required DOM element not found: #root/
    );
  });
});
