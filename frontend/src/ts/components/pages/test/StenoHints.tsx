import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
  on,
  createMemo,
  onMount,
} from "solid-js";

import { getConfig } from "../../../config/store";
import { showModal } from "../../../states/modals";
import { isTestActive, isTestFinished } from "../../../states/test";
import { wordsRenderState } from "../../../states/words-render";
import { parseStroke } from "../../../steno/board";
import {
  buildHint,
  HintPart,
  MAX_PHRASE_WORDS,
  nextStrokeIndex,
  Outline,
  StenoHint,
} from "../../../steno/hints";
import {
  connectPlover,
  disconnectPlover,
  getPloverDictionaries,
  getRecentStrokes,
  isPloverConnected,
  lookupOutlines,
  lookupSymbol,
  refreshPlover,
  startStrokeCount,
  stopStrokeCount,
} from "../../../steno/plover";
import { testRestartedEvent } from "../../../test/test-page-bridge";
import { cn } from "../../../utils/cn";
import { StenoBoard } from "./StenoBoard";

// alternatives listed under a word's outline, the rest counted. A mark
// lists one: its other source (symbol dictionary or theory)
const ALTERNATES_SHOWN = 3;
// words after the active one looked up early, so their hint shows at once
const WARM_AHEAD = 2;
// how long Plover gets to answer before the setup steps are offered. A local
// connection opens or fails in milliseconds
const SETUP_OFFER_MS = 1500;
// once per page load, not each time the test page mounts
let setupOffered = false;

/**
 * How to make the next stroke, below the words: for the active word, or the
 * one after it once that stands complete (see nextStrokeIndex). Two panels: the word's
 * strokes (with cap and punctuation strokes around it), and a phrase brief
 * covering the next words too. Each stroke is a column: the outline, with its
 * alternatives right under it. Rows of fixed height, so nothing moves while
 * typing. In diagram mode outlines are drawn on a steno board. Below them,
 * the strokes Plover reports, to compare with the hint. Steno mode
 * connects to Plover, with or without hints: the modes notice and the steno
 * modal show the connection.
 */
export function StenoHints(): JSXElement {
  const [hint, setHint] = createSignal<StenoHint>();

  createEffect(() => {
    if (!getConfig.stenoMode) return;
    connectPlover();
    onCleanup(disconnectPlover);
  });
  testRestartedEvent.useListener(() => {
    void refreshPlover();
    startStrokeCount();
  });

  // Plover doesn't answer: the steno modal comes up with how to set it up
  onMount(() => {
    const timeout = setTimeout(() => {
      if (
        setupOffered ||
        !getConfig.stenoMode ||
        isPloverConnected() ||
        isTestActive()
      ) {
        return;
      }
      setupOffered = true;
      showModal("Steno");
    }, SETUP_OFFER_MS);
    onCleanup(() => clearTimeout(timeout));
  });
  // the result shows the strokes of the test alone
  createEffect(
    on(isTestFinished, (finished) => finished && stopStrokeCount(), {
      defer: true,
    }),
  );

  // a memo: reads the input of every keypress, changes once per word
  const strokeIndex = createMemo(() => {
    const index = wordsRenderState.renderedActiveWordIndex;
    return nextStrokeIndex(index, wordsRenderState.words[index]);
  });

  createEffect(() => {
    if (
      !getConfig.stenoMode ||
      getConfig.stenoHints === "off" ||
      !isPloverConnected()
    ) {
      setHint(undefined);
      return;
    }
    const index = strokeIndex();
    // snapshot of the words read below, from the previous one (sentence end).
    // By index: slicing would also track the length, which grows mid test
    const first = index - 1;
    const texts: (string | undefined)[] = [];
    for (let i = first; i < index + WARM_AHEAD + MAX_PHRASE_WORDS; i++) {
      texts.push(wordsRenderState.words[i]?.text);
    }
    const wordAt = (i: number): string | undefined => texts[i - first];

    let stale = false;
    onCleanup(() => (stale = true));
    const sources = {
      lookup: lookupOutlines,
      symbols: lookupSymbol,
      dictOrder: getPloverDictionaries(),
    };
    void buildHint(wordAt, index, sources).then((result) => {
      if (!stale) setHint(result);
    });
    for (let ahead = 1; ahead <= WARM_AHEAD; ahead++) {
      void buildHint(wordAt, index + ahead, sources);
    }
  });

  return (
    <Show when={hint()}>
      {(shown) => {
        // a word in pieces ("well", "-", "known"): each says what it writes
        const inPieces = (): boolean =>
          shown().parts.filter((part) => part.kind === "word").length > 1;
        return (
          <div
            data-ui-element="stenoHints"
            class="mt-[0.5em] grid grid-cols-1 gap-x-[2em] gap-y-[0.6em] text-[0.5em] leading-none select-none lg:grid-cols-[3fr_2fr]"
          >
            <Panel label="stroke" parts={shown().parts}>
              {(part) => (
                <Column
                  part={part}
                  caption={
                    part.spelled === true
                      ? "spell"
                      : part.kind === "mark" || inPieces()
                        ? part.text
                        : undefined
                  }
                />
              )}
            </Panel>
            <Panel label="phrase" parts={shown().phrase}>
              {(part) => <Column part={part} caption={part.text} />}
            </Panel>
            <Tape />
          </div>
        );
      }}
    </Show>
  );
}

/**
 * What was actually stroked, newest last, to hold against the hint. Undo
 * strokes stand out: each took the stroke before it back.
 */
function Tape(): JSXElement {
  return (
    <div class="flex items-center gap-x-[1em] lg:col-span-2">
      {/* as wide as the panels' labels, so the strokes start where theirs do */}
      <span
        class={cn("grid text-[0.7em] text-sub", {
          invisible: getRecentStrokes().length === 0,
        })}
      >
        <span class="invisible col-start-1 row-start-1">stroke</span>
        <span class="col-start-1 row-start-1">you</span>
      </span>
      <div class={cn("flex items-center gap-[1em]", alternatesRowClass)}>
        <For each={getRecentStrokes()}>
          {(stroke, i) => (
            <span
              class={cn(
                stroke.isUndo
                  ? "text-error"
                  : i() === getRecentStrokes().length - 1
                    ? "text-text"
                    : "text-sub",
              )}
            >
              {stroke.rtfcre}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}

// row heights shared by the labels and every column, so they line up: the
// outline (taller with boards), then its alternatives
const outlineRowClass = (): string =>
  getConfig.stenoHints === "diagram" ? "h-[4.7em]" : "h-[2.1em]";
const alternatesRowClass = "min-h-[1.6em]";

/** Labelled columns, one per part. No parts: keeps its place, empty. */
function Panel(props: {
  label: string;
  parts: HintPart[];
  children: (part: HintPart) => JSXElement;
}): JSXElement {
  const parts = (): HintPart[] => props.parts;
  const hasAlternates = (): boolean =>
    parts().some((part) => part.outlines.length > 1);
  return (
    <div class="flex gap-x-[1em]">
      {/* the font size is on the text: the rows are as high as the columns' */}
      <div class="grid content-start gap-y-[0.3em] text-sub">
        <span
          class={cn("flex items-center", outlineRowClass(), {
            invisible: parts().length === 0,
          })}
        >
          <span class="text-[0.7em]">{props.label}</span>
        </span>
        <span
          class={cn("flex items-center", alternatesRowClass, {
            invisible: !hasAlternates(),
          })}
        >
          <span class="text-[0.7em]">also</span>
        </span>
      </div>
      {/* wraps only for what doesn't fit in a line: many marks, a long word spelled out */}
      <div class="flex flex-wrap gap-x-[1.2em] gap-y-[0.3em]">
        <For each={parts()}>{props.children}</For>
      </div>
    </div>
  );
}

/**
 * A part's outline over its alternatives. `caption`: what it writes, for
 * marks, the pieces of a split word and phrases. A whole word is in the test.
 * A spelled out word stays text: a board per letter is too much.
 */
function Column(props: { part: HintPart; caption?: string }): JSXElement {
  const isWord = (): boolean => props.part.kind === "word";
  const alternates = (): Outline[] =>
    props.part.outlines.slice(1, isWord() ? 1 + ALTERNATES_SHOWN : 2);
  // more of a mark's aren't counted: mostly a fallback dictionary's misstrokes
  const more = (): number =>
    isWord() ? props.part.outlines.length - 1 - alternates().length : 0;
  return (
    <Show
      when={props.part.outlines[0]}
      fallback={
        // marks without an entry are left out
        <Show when={isWord()}>
          <div class={cn("flex items-center text-sub", outlineRowClass())}>
            not in your dictionaries
          </div>
        </Show>
      }
    >
      {(outline) => (
        <div class="grid content-start gap-y-[0.3em]">
          <div
            class={cn("flex items-end gap-[0.5em]", outlineRowClass())}
            title={outline().dict}
          >
            <Show when={props.caption}>
              <span class="text-sub">{props.caption}</span>
            </Show>
            {/* the one read at speed: larger than the alternatives. Bottom
                aligned: boards differ in size, their stroke names share a line */}
            <span class="text-[1.3em]">
              <Strokes
                outline={outline()}
                dimmed={!isWord()}
                board={props.part.spelled !== true}
              />
            </span>
          </div>
          <div
            class={cn(
              "flex items-center gap-[1em] text-sub",
              alternatesRowClass,
            )}
          >
            <For each={alternates()}>
              {(alternate) => (
                <span title={alternate.dict}>
                  {alternate.strokes.join("/")}
                </span>
              )}
            </For>
            <Show when={more() > 0}>
              <span>+{more()}</span>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}

/** An outline stroke by stroke. `board`: drawn on a board in diagram mode. */
function Strokes(props: {
  outline: Outline;
  dimmed?: boolean;
  board?: boolean;
}): JSXElement {
  return (
    <span class="flex items-end gap-[0.3em]">
      <For each={props.outline.strokes}>
        {(stroke, i) => (
          <>
            <Show when={i() > 0}>
              <span class="text-sub">/</span>
            </Show>
            <Stroke stroke={stroke} dimmed={props.dimmed} board={props.board} />
          </>
        )}
      </For>
    </span>
  );
}

function Stroke(props: {
  stroke: string;
  dimmed?: boolean;
  board?: boolean;
}): JSXElement {
  // undefined: not a stroke of the board drawn, shown as text
  const pressed = (): Set<number> | undefined =>
    props.board === true && getConfig.stenoHints === "diagram"
      ? parseStroke(props.stroke)
      : undefined;
  const color = (): string =>
    props.dimmed === true ? "text-text" : "text-main";
  return (
    <Show
      when={pressed()}
      fallback={
        <span
          class={cn(
            "rounded-(--roundness) bg-sub-alt px-[0.45em] py-[0.25em]",
            color(),
          )}
        >
          {props.stroke}
        </span>
      }
    >
      {(keys) => (
        <span class="flex flex-col items-center gap-[0.3em]">
          <StenoBoard pressed={keys()} dimmed={props.dimmed} />
          <span class={cn("text-[0.7em]", color())}>{props.stroke}</span>
        </span>
      )}
    </Show>
  );
}
