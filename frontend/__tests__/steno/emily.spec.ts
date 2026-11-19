import { describe, it, expect } from "vitest";
import { createSymbolLookup, Translate } from "../../src/ts/steno/emily";

// the dictionary's own decoding, for the patterns below
const PATTERNS: Record<string, string[]> = {
  B: [",", "∪", "∨", "∉"],
  R: [".", "•", "·", "…"],
  FPL: ["(", "[", "<", "\\{"],
  FG: ["{#Tab}", "{#Backspace}", "{#Delete}", "{#Escape}"],
};
const STROKE = /^SKWH(A?)(O?)([*-]?)(E?)(U?)([FRPBLG]*)(T?)(S?)$/;

function emily(stroke: string): string | undefined {
  const match = STROKE.exec(stroke);
  if (match === null) return undefined;
  const [, a, o, star, e, u, pattern, t, s] = match;
  const symbol =
    PATTERNS[pattern ?? ""]?.[(e === "E" ? 1 : 0) + (u === "U" ? 2 : 0)];
  if (symbol === undefined) return undefined;
  const repeat = 1 + (s === "S" ? 1 : 0) + (t === "T" ? 2 : 0);
  return (
    `${a === "A" ? "{}" : "{^}"} ${symbol.repeat(repeat)} ` +
    `${o === "O" ? "{}" : "{^}"}${star === "*" ? "{-|}" : ""}`
  );
}

const translate: Translate = async (stroke) => {
  const translation = emily(stroke);
  return translation === undefined
    ? undefined
    : { translation, dict_path: "/d/emily-symbols.py" };
};

const plain = {
  spaceBefore: false,
  spaceAfter: false,
  capNext: false,
  repeat: 1,
};

async function stroke(
  symbol: string,
  spacing = plain,
  from = translate,
): Promise<string | undefined> {
  const outlines = await createSymbolLookup(from)(symbol, spacing);
  return outlines[0]?.outline.join("/");
}

describe("emily's symbols", () => {
  it("finds the stroke of a symbol", async () => {
    expect(await stroke(",")).toBe("SKWH-B");
    expect(await stroke("[")).toBe("SKWHEFPL");
  });

  it("unescapes braces", async () => {
    expect(await stroke("{")).toBe("SKWHEUFPL");
  });

  it("adds spacing, capitalization and repeats", async () => {
    expect(await stroke(",", { ...plain, spaceAfter: true })).toBe("SKWHOB");
    expect(await stroke("(", { ...plain, spaceBefore: true })).toBe("SKWHAFPL");
    expect(
      await stroke(".", { ...plain, spaceAfter: true, capNext: true }),
    ).toBe("SKWHO*R");
    expect(await stroke(".", { ...plain, repeat: 2 })).toBe("SKWH-RS");
    expect(await stroke(".", { ...plain, repeat: 3 })).toBe("SKWH-RT");
    expect(await stroke(".", { ...plain, repeat: 4 })).toBe("SKWH-RTS");
  });

  it("has no stroke for commands, unknown symbols and long runs", async () => {
    expect(await stroke("{#Tab}")).toBeUndefined();
    expect(await stroke("@")).toBeUndefined();
    expect(await stroke(".", { ...plain, repeat: 5 })).toBeUndefined();
  });

  it("drops a stroke Plover translates differently", async () => {
    const overridden: Translate = async (s) =>
      s === "SKWHOB"
        ? { translation: "something else", dict_path: "/d/user.json" }
        : translate(s);
    expect(
      await stroke(",", { ...plain, spaceAfter: true }, overridden),
    ).toBeUndefined();
    expect(await stroke(",", plain, overridden)).toBe("SKWH-B");
  });

  it("reports the dictionary defining the stroke", async () => {
    const outlines = await createSymbolLookup(translate)(",", plain);
    expect(outlines).toEqual([
      { outline: ["SKWH-B"], dict_path: "/d/emily-symbols.py" },
    ]);
  });
});
