import { describe, it, expect } from "vitest";
import { getDefaultConfig } from "../../src/ts/constants/default-config";
import { stenoConflicts, stenoSettings } from "../../src/ts/steno/settings";

describe("steno settings", () => {
  it("has no conflict with the defaults", () => {
    expect(stenoConflicts(getDefaultConfig())).toEqual([]);
  });

  it("lists the settings in Plover's way", () => {
    const config = {
      ...getDefaultConfig(),
      freedomMode: false,
      confidenceMode: "max" as const,
      difficulty: "master" as const,
    };
    expect(stenoConflicts(config)).toEqual([
      "freedomMode",
      "confidenceMode",
      "difficulty",
    ]);
  });

  it("leaves expert difficulty alone", () => {
    const config = { ...getDefaultConfig(), difficulty: "expert" as const };
    expect(stenoSettings(config).difficulty).toBeUndefined();
    expect(stenoConflicts(config)).toEqual([]);
  });

  it("is settled once applied", () => {
    const config = {
      ...getDefaultConfig(),
      strictSpace: true,
      stopOnError: "word" as const,
      deleteOnError: "letter" as const,
      difficulty: "master" as const,
    };
    expect(stenoConflicts({ ...config, ...stenoSettings(config) })).toEqual([]);
  });
});
