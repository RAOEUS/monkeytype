// Builds the steno hint for a test word out of Plover reverse lookups. Pure:
// the lookups come in as a function (plover.ts in the app, a table in tests).

import type { SymbolLookup } from "./emily";

/** An outline as plover_engine_server's reverse_lookup_with_dicts returns it. */
export type RawOutline = { outline: string[]; dict_path: string };

export type Lookup = (translation: string) => Promise<RawOutline[]>;

/** Where hints come from: Plover in the app, tables in tests. */
export type Sources = {
  /** reverse lookup: the outlines writing a translation, unranked */
  lookup: Lookup;
  /** strokes of a symbol dictionary without reverse lookups */
  symbols?: SymbolLookup;
  /** paths of Plover's dictionaries, highest priority first */
  dictOrder: string[];
};

export type Outline = {
  strokes: string[];
  /** file name of the dictionary defining it */
  dict: string;
};

export type HintPart = {
  /** what the outlines write: the word, a punctuation mark, "cap", a phrase */
  text: string;
  /** a word (or a piece of one), or a mark around it: punctuation, cap, 's */
  kind: "word" | "mark";
  /** best first. Empty: no dictionary writes it */
  outlines: Outline[];
  /** no entry writes the word: its outline fingerspells it */
  spelled?: true;
  /** a mark whose stroke capitalizes the word after it */
  capsNext?: true;
};

export type StenoHint = {
  /**
   * in the order they are stroked: leading punctuation, a case stroke
   * ("cap", "lower", "caps") when the word needs one, word, trailing.
   * A word without an entry comes in pieces: "well", "-", "known"
   */
  parts: HintPart[];
  /** index of the (first piece of the) word, undefined for punctuation only */
  wordPart: number | undefined;
  /**
   * longest entry writing this word and the next ones in fewer strokes, after
   * the case stroke it needs. Empty: none
   */
  phrase: HintPart[];
};

export const MAX_PHRASE_WORDS = 5;
const EDGES = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;
const SENTENCE_END = /[.?!]["')\]]*$/;

function split(word: string): [lead: string, core: string, trail: string] {
  const match = EDGES.exec(word);
  return [match?.[1] ?? "", match?.[2] ?? "", match?.[3] ?? ""];
}

/**
 * Best first: dictionary priority (Plover's order), then fewest strokes, then
 * shortest. Not shortest first: that recommends misstroke entries of a
 * fallback dictionary over the theory's own outline.
 * `demoteProgrammatic` ranks python dictionaries last: for a single word, a
 * phrasing dictionary's stroke is rarely the one to use.
 */
function rank(
  raw: RawOutline[],
  dictOrder: string[],
  demoteProgrammatic: boolean,
): Outline[] {
  const key = (o: RawOutline): number[] => {
    const priority = dictOrder.indexOf(o.dict_path);
    return [
      demoteProgrammatic && o.dict_path.endsWith(".py") ? 1 : 0,
      priority === -1 ? dictOrder.length : priority,
      o.outline.length,
      o.outline.join("/").length,
    ];
  };
  return raw
    .map((o) => ({ o, key: key(o) }))
    .sort((a, b) => {
      for (const [i, value] of a.key.entries()) {
        const diff = value - (b.key[i] as number);
        if (diff !== 0) return diff;
      }
      return 0;
    })
    .map(({ o }) => ({
      strokes: o.outline,
      dict: o.dict_path.split(/[/\\]/).pop() ?? o.dict_path,
    }));
}

/** Outlines of the first candidate any dictionary writes, and which it was. */
async function firstMatch(
  candidates: string[],
  lookup: Lookup,
): Promise<{ translation: string; raw: RawOutline[] } | undefined> {
  const results = await Promise.all(candidates.map(lookup));
  const index = results.findIndex((raw) => raw.length > 0);
  if (index === -1) return undefined;
  return {
    translation: candidates[index] as string,
    raw: results[index] as RawOutline[],
  };
}

function decapitalize(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

type CaseChange = "cap" | "lower" | "upper";

// both spellings Plover knows, with and without the {} lapwing puts first
const CASE_TRANSLATIONS: Record<CaseChange, string[]> = {
  cap: ["{}{-|}", "{-|}", "{}{:case:cap_first_word}", "{:case:cap_first_word}"],
  lower: [
    "{}{>}",
    "{>}",
    "{}{:case:lower_first_char}",
    "{:case:lower_first_char}",
  ],
  upper: [
    "{}{<}",
    "{<}",
    "{}{:case:upper_first_word}",
    "{:case:upper_first_word}",
  ],
};
const CASE_NAMES: Record<CaseChange, string> = {
  cap: "cap",
  lower: "lower",
  upper: "caps",
};

/** The stroke changing the case of what comes next, if a dictionary has one. */
async function casePart(
  change: CaseChange,
  { lookup, dictOrder }: Sources,
): Promise<HintPart | undefined> {
  const raw = (await Promise.all(CASE_TRANSLATIONS[change].map(lookup))).flat();
  if (raw.length === 0) return undefined;
  return {
    text: CASE_NAMES[change],
    kind: "mark",
    outlines: rank(raw, dictOrder, false),
  };
}

/**
 * How to write `text` in the case it has: the case stroke it needs, if any,
 * then its entry. Entries rarely come in every case, so the lowercase one is
 * tried with a cap stroke (or a caps stroke for a word in capitals), and after
 * a stroke that capitalizes by itself (`autoCap`) a lowercase text needs a
 * lower stroke. Undefined when nothing writes it. `keep`: the outlines wanted.
 */
async function casedParts(
  text: string,
  autoCap: boolean,
  sources: Sources,
  options: {
    demoteProgrammatic: boolean;
    keep?: (outline: Outline) => boolean;
  },
): Promise<HintPart[] | undefined> {
  const first = text.charAt(0);
  const isCapitalized = first !== first.toLowerCase();
  const isLowercase = first !== first.toUpperCase();
  const isInCapitals =
    text.length > 1 &&
    !text.includes(" ") &&
    text === text.toUpperCase() &&
    text !== text.toLowerCase();

  type Candidate = { translation: string; change: CaseChange | undefined };
  const exact: Candidate = {
    translation: text,
    change: autoCap && isLowercase ? "lower" : undefined,
  };
  const lower: Candidate[] = isCapitalized
    ? [{ translation: decapitalize(text), change: autoCap ? undefined : "cap" }]
    : [];
  const capitals: Candidate[] = isInCapitals
    ? [{ translation: text.toLowerCase(), change: "upper" }]
    : [];
  // preferred first: Plover capitalizing by itself is free
  const candidates = autoCap
    ? [...lower, exact, ...capitals]
    : [exact, ...lower, ...capitals];

  const found = await Promise.all(
    candidates.map(async ({ translation, change }) => {
      const outlines = rank(
        await sources.lookup(translation),
        sources.dictOrder,
        options.demoteProgrammatic,
      ).filter(options.keep ?? (() => true));
      const best = outlines[0];
      if (best === undefined) return undefined;
      const caseStroke =
        change === undefined ? undefined : await casePart(change, sources);
      // no stroke to put it in its case: not a way to write it
      if (change !== undefined && caseStroke === undefined) return undefined;
      const part: HintPart = { text, kind: "word", outlines };
      return {
        parts: caseStroke === undefined ? [part] : [caseStroke, part],
        strokes:
          best.strokes.length + (caseStroke?.outlines[0]?.strokes.length ?? 0),
      };
    }),
  );
  // fewest strokes, the preferred on a tie: "I" has its own stroke where "i"
  // is spelled out, "the" and "The" after a full stop are one stroke each
  return found
    .filter((way) => way !== undefined)
    .sort((a, b) => a.strokes - b.strokes)[0]?.parts;
}

function punctuationCandidates(
  text: string,
  leading: boolean,
  avoidCap: boolean,
): string[] {
  if (leading) return [`{~|${text}^}`, `{${text}^}`, `{^${text}^}`, text];
  // {.} capitalizes what follows: last when the text goes on in lowercase
  return avoidCap
    ? [`{^${text}}`, text, `{${text}}`]
    : [`{${text}}`, `{^~|${text}}`, `{^${text}}`, `{^${text}^}`, text];
}

/** Runs of the same mark: "..." is one stroke in a symbol dictionary. */
function runs(chars: string): { char: string; length: number }[] {
  const result: { char: string; length: number }[] = [];
  // code points are what's wanted: one mark each
  // oxlint-disable-next-line no-misused-spread
  for (const char of [...chars]) {
    const last = result[result.length - 1];
    if (last?.char === char) last.length++;
    else result.push({ char, length: 1 });
  }
  return result;
}

type Edge = {
  spaceBefore: boolean;
  spaceAfter: boolean;
  /** the word after is capitalized: the last mark has to see to it */
  capNext: boolean;
  /** the word after is lowercase: the last mark must not capitalize it */
  avoidCap: boolean;
};

/** A part per run of marks. `edge`: what is around all of them. */
async function punctuationParts(
  chars: string,
  leading: boolean,
  edge: Edge,
  sources: Sources,
): Promise<HintPart[]> {
  const all = runs(chars);
  return Promise.all(
    all.map(async ({ char, length }, i) => {
      const text = char.repeat(length);
      const isLast = i === all.length - 1;
      const avoidCap = isLast && edge.avoidCap;
      const [match, symbol] = await Promise.all([
        firstMatch(
          punctuationCandidates(text, leading, avoidCap),
          sources.lookup,
        ),
        sources.symbols?.(char, {
          spaceBefore: i === 0 && edge.spaceBefore,
          spaceAfter: isLast && edge.spaceAfter,
          capNext: isLast && edge.capNext,
          repeat: length,
        }),
      ]);
      // the symbol dictionary's stroke first: the one made for this spacing
      // and capitalization. Dictionary order says what a stroke writes, not
      // which stroke to use
      const symbolOutlines = rank(symbol ?? [], sources.dictOrder, false);
      const entryCapitalizes =
        /^[.?!]$/.test(text) && match?.translation === `{${text}}`;
      // not listed under a stroke that keeps the lowercase it would undo
      const entryOutlines =
        avoidCap && entryCapitalizes && symbolOutlines.length > 0
          ? []
          : rank(match?.raw ?? [], sources.dictOrder, false);
      const capsNext =
        symbolOutlines.length > 0 ? isLast && edge.capNext : entryCapitalizes;
      return {
        text,
        kind: "mark" as const,
        outlines: [...symbolOutlines, ...entryOutlines],
        ...(capsNext && { capsNext: true as const }),
      };
    }),
  );
}

/** The marks after a word's last letter, as stroked before the word `next`. */
async function trailingParts(
  trail: string,
  next: string | undefined,
  sources: Sources,
): Promise<HintPart[]> {
  const [, nextCore] = split(next?.trim() ?? "");
  const endsSentence = SENTENCE_END.test(trail);
  const nextIsCapitalized = decapitalize(nextCore) !== nextCore;
  return punctuationParts(
    trail,
    false,
    {
      spaceBefore: false,
      spaceAfter: true,
      // a dictionary's full stop capitalizes by itself, a symbol stroke has to
      capNext: endsSentence && nextIsCapitalized,
      avoidCap: endsSentence && nextCore !== "" && !nextIsCapitalized,
    },
    sources,
  );
}

/** A mark inside a word, attached on both sides: its part. */
async function attachedMark(
  mark: string,
  candidates: string[],
  sources: Sources,
): Promise<HintPart> {
  const [match, symbol] = await Promise.all([
    firstMatch(candidates, sources.lookup),
    sources.symbols?.(mark, {
      spaceBefore: false,
      spaceAfter: false,
      capNext: false,
      repeat: 1,
    }),
  ]);
  return {
    text: mark,
    kind: "mark",
    outlines: [
      ...rank(symbol ?? [], sources.dictOrder, false),
      ...rank(match?.raw ?? [], sources.dictOrder, false),
    ],
  };
}

/** The word letter by letter. Undefined when a character has no stroke. */
async function fingerspell(
  word: string,
  { lookup, dictOrder }: Sources,
): Promise<Outline | undefined> {
  const letters = await Promise.all(
    // oxlint-disable-next-line no-misused-spread -- a stroke per code point
    [...word].map(async (char) => {
      const isLower = char.toLowerCase() === char;
      const match = await firstMatch(
        isLower ? [`{>}{&${char}}`, `{&${char}}`] : [`{&${char}}`],
        lookup,
      );
      return rank(match?.raw ?? [], dictOrder, true)[0];
    }),
  );
  const strokes: string[] = [];
  for (const letter of letters) {
    if (letter === undefined) return undefined;
    strokes.push(...letter.strokes);
  }
  return { strokes, dict: "fingerspelling" };
}

/**
 * A word no entry writes whole, from what does write it: the words around
 * its hyphens, the word before a possessive, else its letters.
 */
async function spellOut(word: string, sources: Sources): Promise<HintPart[]> {
  const whole = await casedParts(word, false, sources, {
    demoteProgrammatic: true,
  });
  if (whole !== undefined) return whole;

  const pieces = word.split("-");
  if (pieces.length > 1 && !pieces.includes("")) {
    const [hyphen, ...words] = await Promise.all([
      attachedMark("-", ["{^-^}"], sources),
      ...pieces.map(async (piece) => spellOut(piece, sources)),
    ]);
    return words.flatMap((parts, i) => (i === 0 ? parts : [hyphen, ...parts]));
  }

  if (word.endsWith("'s") && word.length > 2) {
    const [base, possessive] = await Promise.all([
      spellOut(word.slice(0, -2), sources),
      attachedMark("'s", ["{^'s}"], sources),
    ]);
    if (possessive.outlines.length > 0) return [...base, possessive];
  }

  const spelled = await fingerspell(word, sources);
  return spelled === undefined
    ? [{ text: word, kind: "word", outlines: [] }]
    : [{ text: word, kind: "word", outlines: [spelled], spelled: true }];
}

/** The longest phrase from `index` on with a brief, as casedParts gives it. */
async function findPhrase(
  wordAt: (index: number) => string | undefined,
  index: number,
  autoCap: boolean,
  sources: Sources,
): Promise<HintPart[]> {
  // cores of this word and the next ones, up to the first punctuation between
  const cores: string[] = [];
  for (let i = 0; i < MAX_PHRASE_WORDS; i++) {
    const word = wordAt(index + i);
    if (word === undefined) break;
    const [lead, core, trail] = split(word);
    if (core === "" || (i > 0 && lead !== "")) break;
    cores.push(core);
    if (trail !== "") break;
  }

  const phrases = await Promise.all(
    cores.slice(1).map(async (_, i) => {
      const wordCount = i + 2;
      return casedParts(cores.slice(0, wordCount).join(" "), autoCap, sources, {
        demoteProgrammatic: false,
        // an outline as long as stroking the words one by one is no shortcut
        keep: (outline) => outline.strokes.length < wordCount,
      });
    }),
  );
  return phrases.findLast((phrase) => phrase !== undefined) ?? [];
}

/**
 * The word the next stroke writes. Plover types the space before a word, with
 * it: once the active word stands complete the test still waits on it, and
 * the stroke to make is the next word's.
 */
export function nextStrokeIndex(
  activeIndex: number,
  active: { text: string; input: string } | undefined,
): number {
  // a word can end in its newline or tab, typed with the next too
  const isComplete =
    active !== undefined &&
    active.text !== "" &&
    active.input === active.text.trimEnd();
  return isComplete ? activeIndex + 1 : activeIndex;
}

/** Hint for the word at `index`. */
export async function buildHint(
  wordAt: (index: number) => string | undefined,
  index: number,
  sources: Sources,
): Promise<StenoHint | undefined> {
  // a word can end in its newline or tab
  const word = wordAt(index)?.trim();
  if (word === undefined || word === "") return undefined;

  const [lead, core, trail] = split(word);

  // marks only: a word of its own, spaced on both sides
  if (core === "") {
    const parts = await punctuationParts(
      word,
      false,
      { spaceBefore: true, spaceAfter: true, capNext: false, avoidCap: false },
      sources,
    );
    return { parts, wordPart: undefined, phrase: [] };
  }

  // whether Plover capitalizes this word by itself: up to the stroke hinted
  // for the end of the word before
  const [, , previousTrail] = split(wordAt(index - 1)?.trim() ?? "");
  const autoCap =
    previousTrail !== "" &&
    (await trailingParts(previousTrail, word, sources)).some(
      (part) => part.capsNext === true,
    );

  const [leading, trailing, wordParts, phrase] = await Promise.all([
    punctuationParts(
      lead,
      true,
      { spaceBefore: true, spaceAfter: false, capNext: false, avoidCap: false },
      sources,
    ),
    trailingParts(trail, wordAt(index + 1), sources),
    casedParts(core, autoCap, sources, { demoteProgrammatic: true }),
    findPhrase(wordAt, index, autoCap, sources),
  ]);

  const parts = [
    ...leading,
    ...(wordParts ?? (await spellOut(core, sources))),
    ...trailing,
  ];
  const firstWordPart = parts.findIndex((part) => part.kind === "word");
  const wordPart = firstWordPart === -1 ? undefined : firstWordPart;

  return { parts, wordPart, phrase };
}
