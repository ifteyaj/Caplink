import { describe, expect, it } from "vitest";
import { parseEnv } from "../../server/config/env";

describe("parseEnv", () => {
  it("applies safe defaults when values are missing", () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_PATH).toBe("./caplink.db");
  });

  it("accepts explicit valid values", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      PORT: "8080",
      DATABASE_PATH: "/tmp/caplink/custom.db",
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_PATH).toBe("/tmp/caplink/custom.db");
  });

  it("rejects an invalid NODE_ENV", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow(/Invalid environment configuration/);
  });

  it("rejects an out-of-range PORT", () => {
    expect(() => parseEnv({ PORT: "70000" })).toThrow(/Invalid environment configuration/);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseEnv({ PORT: "abc" })).toThrow(/Invalid environment configuration/);
  });

  it("rejects an empty DATABASE_PATH", () => {
    expect(() => parseEnv({ DATABASE_PATH: "" })).toThrow(/Invalid environment configuration/);
  });
});
