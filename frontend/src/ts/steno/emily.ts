// Emily's symbols (https://github.com/EPLHREU/emily-symbols): a python
// dictionary writing a symbol in one stroke. After the starter: A/O put a
// space before/after, * capitalizes what follows, E/U pick a variant, a right
// hand pattern picks the symbol, -S/-T repeat it.
// It answers no reverse lookups, so the symbols are read by translating every
// pattern once, and each stroke suggested is checked against Plover: an edited
// table, another attachment method or an overriding entry never give a wrong
// hint, at worst none.
import type { RawOutline } from "./hints";

// ponytail: the default starter only, custom starters aren't found
const STARTER = "SKWH";
const VARIANTS = ["", "E", "U", "EU"];
const PATTERN_KEYS = "FRPBLG";
const MAX_REPEAT = 4;
// what a stroke without A, O and * translates to
const ATTACHED = /^\{\^\} ([\s\S]+) \{\^\}$/;

export type Translation = { translation: string; dict_path: string };
/** What `stroke` translates to in Plover, undefined when nothing. */
export type Translate = (stroke: string) => Promise<Translation | undefined>;

export type SymbolSpacing = {
  spaceBefore: boolean;
  spaceAfter: boolean;
  /** capitalize the word after */
  capNext: boolean;
  /** how many of the symbol, in one stroke */
  repeat: number;
};

/** Strokes writing `symbol` that way: one, or none. */
export type SymbolLookup = (
  symbol: string,
  spacing: SymbolSpacing,
) => Promise<RawOutline[]>;

type Entry = {
  variant: string;
  pattern: string;
  /** the symbol as the dictionary spells it: braces escaped */
  raw: string;
};

function toStroke(left: string, right: string): string {
  return STARTER + (left === "" && right !== "" ? "-" : "") + left + right;
}

async function readTable(translate: Translate): Promise<Map<string, Entry>> {
  const patterns = Array.from({ length: 2 ** PATTERN_KEYS.length }, (_, mask) =>
    PATTERN_KEYS.split("")
      .filter((_key, bit) => (mask & (1 << bit)) !== 0)
      .join(""),
  );
  // plain variants first: the simplest stroke of a symbol wins
  const entries = VARIANTS.flatMap((variant) =>
    patterns.map((pattern) => ({ variant, pattern })),
  );
  const translations = await Promise.all(
    entries.map(async ({ variant, pattern }) =>
      translate(toStroke(variant, pattern)),
    ),
  );

  const table = new Map<string, Entry>();
  for (const [i, entry] of entries.entries()) {
    const raw = ATTACHED.exec(translations[i]?.translation ?? "")?.[1];
    // commands and macros ({#Tab}, {*!}) write no symbol
    if (raw === undefined || raw.startsWith("{")) continue;
    const symbol = raw.replace(/\\([{}])/g, "$1");
    if (!table.has(symbol)) table.set(symbol, { ...entry, raw });
  }
  return table;
}

/** Reads the symbols on the first lookup. Make a new one when Plover's dictionaries change. */
export function createSymbolLookup(translate: Translate): SymbolLookup {
  let table: Promise<Map<string, Entry>> | undefined;

  return async (symbol, spacing) => {
    table ??= readTable(translate);
    const entry = (await table).get(symbol);
    if (entry === undefined || spacing.repeat > MAX_REPEAT) return [];

    const repeats = spacing.repeat - 1;
    const stroke = toStroke(
      (spacing.spaceBefore ? "A" : "") +
        (spacing.spaceAfter ? "O" : "") +
        (spacing.capNext ? "*" : "") +
        entry.variant,
      entry.pattern +
        ((repeats & 2) !== 0 ? "T" : "") +
        ((repeats & 1) !== 0 ? "S" : ""),
    );
    const expected =
      `${spacing.spaceBefore ? "{}" : "{^}"} ${entry.raw.repeat(spacing.repeat)} ` +
      `${spacing.spaceAfter ? "{}" : "{^}"}${spacing.capNext ? "{-|}" : ""}`;

    const actual = await translate(stroke);
    if (actual?.translation !== expected) return [];
    return [{ outline: [stroke], dict_path: actual.dict_path }];
  };
}
