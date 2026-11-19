import { describe, it, expect } from "vitest";
import { KEY_SHAPES, parseStroke } from "../../src/ts/steno/board";

const ORDER = [
  "#",
  "S-",
  "T-",
  "K-",
  "P-",
  "W-",
  "H-",
  "R-",
  "A",
  "O",
  "*",
  "E",
  "U",
  "-F",
  "-R",
  "-P",
  "-B",
  "-L",
  "-G",
  "-T",
  "-S",
  "-D",
  "-Z",
];

function keys(stroke: string): string | undefined {
  const pressed = parseStroke(stroke);
  if (pressed === undefined) return undefined;
  return [...pressed]
    .sort((a, b) => a - b)
    .map((key) => ORDER[key])
    .join(" ");
}

describe("steno board", () => {
  it("has a shape for every key", () => {
    expect(KEY_SHAPES).toHaveLength(ORDER.length);
  });

  it.each([
    ["TEFT", "T- E -F -T"],
    ["-T", "-T"],
    ["T-T", "T- -T"],
    ["KW-BG", "K- W- -B -G"],
    ["#HROPBD", "# H- R- O -P -B -D"],
    ["R*UPBG", "R- * U -P -B -G"],
    ["STKPWHR-BSZ", "S- T- K- P- W- H- R- -B -S -Z"],
    ["TS", "T- -S"],
    ["ST", "S- T-"],
    ["EU", "E U"],
    ["#-T", "# -T"],
    // number bar spellings
    ["1-9", "# S- -T"],
    ["50", "# A O"],
  ])("parses %s", (stroke, expected) => {
    expect(keys(stroke)).toBe(expected);
  });

  it.each(["", "^TEFT", "TSK", "hello", "T E"])("rejects %j", (stroke) => {
    expect(parseStroke(stroke)).toBeUndefined();
  });
});
