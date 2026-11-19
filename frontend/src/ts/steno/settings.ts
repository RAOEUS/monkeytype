// What steno mode needs of the other settings. Plover edits the text by
// itself: an undo stroke takes back whole words, the next stroke of an
// outline replaces what the first typed. Settings that refuse or add edits
// leave Plover's idea of the text and the test's apart, and every stroke
// after that lands wrong.
import type { Config } from "@monkeytype/schemas/configs";
import { typedKeys } from "@monkeytype/util/objects";

/** The values steno mode needs, for the settings it has a say in. */
export function stenoSettings(config: Readonly<Config>): Partial<Config> {
  return {
    // two undo strokes in a row delete into a word typed right
    freedomMode: true,
    // refuses the backspaces
    confidenceMode: "off",
    // types the space Plover resends after an undo
    strictSpace: false,
    // these drop or delete characters Plover then deletes again
    stopOnError: "off",
    deleteOnError: "off",
    // fails the test on what the first stroke of an outline types
    ...(config.difficulty === "master" && { difficulty: "normal" as const }),
  };
}

/** The settings that are in steno mode's way as they are. */
export function stenoConflicts(config: Readonly<Config>): (keyof Config)[] {
  const needed = stenoSettings(config);
  return typedKeys(needed).filter((key) => config[key] !== needed[key]);
}
