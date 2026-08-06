import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateFirebaseConfig } from "../src/utils/firebaseConfig.js";

const validFirebaseConfig = {
  apiKey: "AIzaSyValidExampleKey",
  authDomain: "barberos.firebaseapp.com",
  projectId: "barberos",
  storageBucket: "barberos.appspot.com",
  messagingSenderId: "667404318114",
  appId: "1:667404318114:web:abc123",
};

describe("firebase config validation", () => {
  it("accepts a complete Firebase config", () => {
    assert.equal(validateFirebaseConfig(validFirebaseConfig), validFirebaseConfig);
  });

  it("rejects missing required config values", () => {
    assert.throws(
      () =>
        validateFirebaseConfig({
          ...validFirebaseConfig,
          apiKey: "",
          appId: undefined,
        }),
      /Firebase config invalid or missing: apiKey, appId/
    );
  });

  it("rejects placeholder values copied from env examples", () => {
    assert.throws(
      () =>
        validateFirebaseConfig({
          ...validFirebaseConfig,
          projectId: "your_project_id",
          messagingSenderId: "your_sender_id",
        }),
      /projectId, messagingSenderId/
    );
  });
});
