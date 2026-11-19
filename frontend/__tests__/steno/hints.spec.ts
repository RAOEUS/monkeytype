import { describe, it, expect } from "vitest";
import type { SymbolLookup } from "../../src/ts/steno/emily";
import {
  buildHint,
  HintPart,
  nextStrokeIndex,
  RawOutline,
  Sources,
} from "../../src/ts/steno/hints";

// highest priority first, as Plover lists them
const dictOrder = [
  "/d/user.json",
  "/d/phrasing.py",
  "/d/base.json",
  "/d/main.json",
];

const entries: Record<string, [outline: string, dict: string][]> = {
  test: [
    ["TEF", "main"],
    ["T*ES", "main"],
    ["TEFT", "base"],
  ],
  know: [
    ["STWR-PB", "phrasing"],
    ["TPHOE", "base"],
  ],
  hello: [["HEL/HROE", "base"]],
  the: [["-T", "base"]],
  The: [["#-T", "base"]],
  london: [["HROPB/TKOPB", "base"]],
  // the newer spelling of {}{-|}, as lapwing's commands have it
  "{}{:case:cap_first_word}": [["KPA", "base"]],
  "{>}": [["HRO*ER", "base"]],
  "{<}": [["KPA*D", "base"]],
  ok: [["OBG", "base"]],
  "if you": [["TPU", "base"]],
  if: [["TP", "base"]],
  you: [["U", "base"]],
  well: [["WEL", "base"]],
  known: [["TPHOEPB", "base"]],
  "{^-^}": [["H-PB", "base"]],
  John: [["SKWROPB", "base"]],
  "{^'s}": [["AES", "base"]],
  "{>}{&z}": [["STKPW*", "base"]],
  "{>}{&y}": [["KWR*", "base"]],
  "{>}{&x}": [["KP*", "base"]],
  "{&Z}": [["STKPW*P", "base"]],
  "{,}": [
    ["-RBGS", "main"],
    ["KW-BG", "base"],
  ],
  "{.}": [["TP-PL", "base"]],
  '{~|"^}': [["KW-GS", "base"]],
  I: [["EU", "base"]],
  i: [["*EU/SP-S", "base"]],
  "I don't": [["SWR*", "phrasing"]],
  "I don't know": [
    ["EU/TKOEPBT/TPHOE", "main"],
    ["KWROEPB", "main"],
    ["SWR*PB", "phrasing"],
  ],
};

async function lookup(translation: string): Promise<RawOutline[]> {
  return (entries[translation] ?? []).map(([outline, dict]) => ({
    outline: outline.split("/"),
    dict_path: `/d/${dict}.${dict === "phrasing" ? "py" : "json"}`,
  }));
}

// a python symbol dictionary: its stroke spells out what was asked
const symbols: SymbolLookup = async (symbol, spacing) => {
  if (!"(.-=".includes(symbol)) return [];
  const flags =
    (spacing.spaceBefore ? "A" : "") +
    (spacing.spaceAfter ? "O" : "") +
    (spacing.capNext ? "*" : "");
  return [
    {
      outline: [`SYM${flags}[${symbol}x${spacing.repeat}]`],
      dict_path: "/d/phrasing.py",
    },
  ];
};

const sources: Sources = { lookup, symbols, dictOrder };

async function hint(
  text: string,
  index = 0,
  from = sources,
): Promise<{
  parts: string[] | undefined;
  phrase: string | undefined;
  wordPart: number | undefined;
}> {
  const words = text.split(" ");
  const result = await buildHint((i) => words[i], index, from);
  const show = (part: HintPart): string =>
    `${part.text}=${part.outlines.map((o) => o.strokes.join("/")).join(",")}`;
  return {
    parts: result?.parts.map(show),
    phrase:
      result === undefined || result.phrase.length === 0
        ? undefined
        : result.phrase.map(show).join(" + "),
    wordPart: result?.wordPart,
  };
}

describe("steno hints", () => {
  it("ranks by dictionary priority before stroke length", async () => {
    expect((await hint("test")).parts).toEqual(["test=TEFT,TEF,T*ES"]);
  });

  it("ranks python dictionaries last for a single word", async () => {
    expect((await hint("know")).parts).toEqual(["know=TPHOE,STWR-PB"]);
  });

  it("keeps the dictionary file name and multi stroke outlines", async () => {
    const result = await buildHint(() => "hello", 0, sources);
    expect(result?.parts[0]?.outlines).toEqual([
      { strokes: ["HEL", "HROE"], dict: "base.json" },
    ]);
  });

  it("splits punctuation off the word", async () => {
    const result = await hint('"hello, there');
    expect(result.parts).toEqual([
      '"=KW-GS',
      "hello=HEL/HROE",
      ",=KW-BG,-RBGS",
    ]);
    expect(result.wordPart).toBe(1);
  });

  it("reports words no dictionary writes", async () => {
    expect((await hint("qqq")).parts).toEqual(["qqq="]);
  });

  describe("words without an entry", () => {
    it("fingerspells them", async () => {
      const result = await buildHint(() => "Zzyzx", 0, sources);
      expect(result?.parts).toEqual([
        {
          text: "Zzyzx",
          kind: "word",
          spelled: true,
          outlines: [
            {
              strokes: ["STKPW*P", "STKPW*", "KWR*", "STKPW*", "KP*"],
              dict: "fingerspelling",
            },
          ],
        },
      ]);
    });

    it("splits them at hyphens", async () => {
      const result = await hint("a well-known, thing", 1);
      expect(result.parts).toEqual([
        "well=WEL",
        "-=SYM[-x1],H-PB",
        "known=TPHOEPB",
        ",=KW-BG,-RBGS",
      ]);
      expect(result.wordPart).toBe(0);
    });

    it("splits off a possessive", async () => {
      expect((await hint("see John's")).parts).toEqual(["see="]);
      expect((await hint("see John's", 1)).parts).toEqual([
        "John=SKWROPB",
        "'s=AES",
      ]);
    });
  });

  it("prefers the capitalized entry mid sentence", async () => {
    expect((await hint("see The", 1)).parts).toEqual(["The=#-T"]);
  });

  it("prefers the lowercase entry after a sentence end", async () => {
    expect((await hint("done. The", 1)).parts).toEqual(["The=-T"]);
  });

  it("keeps a shorter capitalized entry after a sentence end", async () => {
    expect((await hint("done. I", 1)).parts).toEqual(["I=EU"]);
  });

  it("adds a cap stroke when only a lowercase entry exists", async () => {
    expect((await hint("in London", 1)).parts).toEqual([
      "cap=KPA",
      "London=HROPB/TKOPB",
    ]);
    expect((await hint("done. London", 1)).parts).toEqual([
      "London=HROPB/TKOPB",
    ]);
  });

  it("puts the cap stroke right before the word, after an opening mark", async () => {
    const result = await hint('in "London', 1);
    expect(result.parts).toEqual(['"=KW-GS', "cap=KPA", "London=HROPB/TKOPB"]);
    expect(result.wordPart).toBe(2);
  });

  it("adds a caps stroke for a word in capitals", async () => {
    expect((await hint("say HELLO", 1)).parts).toEqual([
      "caps=KPA*D",
      "HELLO=HEL/HROE",
    ]);
  });

  it("caps a phrase at the start of the test", async () => {
    const result = await hint("If you");
    expect(result.parts).toEqual(["cap=KPA", "If=TP"]);
    expect(result.phrase).toBe("cap=KPA + If you=TPU");
  });

  describe("a lowercase word after a full stop", () => {
    const noSymbols: Sources = { lookup, dictOrder };

    it("gets a full stop that doesn't capitalize it", async () => {
      // the symbol stroke without its cap key, and not {.} under it
      expect((await hint("ok. the")).parts).toEqual(["ok=OBG", ".=SYMO[.x1]"]);
      expect((await hint("ok. the", 1)).parts).toEqual(["the=-T"]);
    });

    it("gets a lower stroke when the full stop has to be {.}", async () => {
      expect((await hint("ok. the", 0, noSymbols)).parts).toEqual([
        "ok=OBG",
        ".=TP-PL",
      ]);
      expect((await hint("ok. the", 1, noSymbols)).parts).toEqual([
        "lower=HRO*ER",
        "the=-T",
      ]);
    });

    it("leaves a capitalized one to {.}", async () => {
      expect((await hint("ok. The", 1, noSymbols)).parts).toEqual(["The=-T"]);
    });
  });

  it("finds the longest phrase, dropping outlines that save no strokes", async () => {
    const result = await hint("I don't know what");
    expect(result.parts).toEqual(["I=EU"]);
    expect(result.phrase).toBe("I don't know=SWR*PB,KWROEPB");
  });

  it("stops phrases at punctuation", async () => {
    expect((await hint("I don't, know")).phrase).toBe("I don't=SWR*");
    expect((await hint("I, don't know")).phrase).toBeUndefined();
  });

  describe("symbol dictionary", () => {
    it("attaches a leading mark to the word, with a space before", async () => {
      expect((await hint("(hello")).parts).toEqual([
        "(=SYMA[(x1]",
        "hello=HEL/HROE",
      ]);
    });

    it("spaces after the last trailing mark only", async () => {
      expect((await hint("hello-. There")).parts).toEqual([
        "hello=HEL/HROE",
        "-=SYM[-x1],H-PB",
        // the stroke made for this spacing first, the theory's entry after
        ".=SYMO*[.x1],TP-PL",
      ]);
    });

    it("capitalizes the next word from a sentence end", async () => {
      expect((await hint("hello. The")).parts).toEqual([
        "hello=HEL/HROE",
        ".=SYMO*[.x1],TP-PL",
      ]);
    });

    it("writes a run of the same mark in one stroke", async () => {
      expect((await hint("hello... there")).parts).toEqual([
        "hello=HEL/HROE",
        "...=SYMO[.x3]",
      ]);
    });

    it("spaces a word of marks on both sides", async () => {
      const result = await hint("a == b", 1);
      expect(result.parts).toEqual(["===SYMAO[=x2]"]);
      expect(result.wordPart).toBeUndefined();
    });
  });

  it("returns nothing past the last word", async () => {
    expect(await buildHint(() => undefined, 0, sources)).toBeUndefined();
  });
});

describe("nextStrokeIndex", () => {
  it("is the active word until it stands complete", () => {
    expect(nextStrokeIndex(3, { text: "hello", input: "" })).toBe(3);
    // the first stroke of an outline
    expect(nextStrokeIndex(3, { text: "hello", input: "hell" })).toBe(3);
    expect(nextStrokeIndex(3, { text: "hello", input: "hellp" })).toBe(3);
    expect(nextStrokeIndex(3, { text: "hello", input: "helloo" })).toBe(3);
  });

  it("is the next word once it does: its space comes with that stroke", () => {
    expect(nextStrokeIndex(3, { text: "hello", input: "hello" })).toBe(4);
    expect(nextStrokeIndex(3, { text: "said.", input: "said" })).toBe(3);
    expect(nextStrokeIndex(3, { text: "said.", input: "said." })).toBe(4);
    expect(nextStrokeIndex(3, { text: "end\n", input: "end" })).toBe(4);
  });

  it("stays put without a word or a text (zen)", () => {
    expect(nextStrokeIndex(3, undefined)).toBe(3);
    expect(nextStrokeIndex(3, { text: "", input: "" })).toBe(3);
  });
});
