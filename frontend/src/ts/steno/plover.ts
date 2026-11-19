// Client of the user's running Plover, through the plover_engine_server plugin
// (https://github.com/RAOEUS/plover_websocket_server). Plover answers the
// lookups itself, so the active system, the dictionary order, overrides,
// disabled and python dictionaries all apply without reimplementing any.
import { createSignal } from "solid-js";
import { z } from "zod";

import { parseWithSchema } from "@monkeytype/util/json";
import { tryCatchSync } from "@monkeytype/util/trycatch";

import { createSymbolLookup, SymbolLookup, Translation } from "./emily";
import type { RawOutline } from "./hints";

// the plugin's default address, changed in the steno modal
const DEFAULT_URL = "ws://localhost:8086/websocket";
const RETRY_MS = 3000;
const MAX_RETRY_MS = 30_000;
// ponytail: Plover reports a stroke after typing its output, so the stroke
// that ends a test arrives after it. Counting goes on this long; a timestamp
// on the plugin's stroked event would be exact.
const COUNT_GRACE_MS = 300;

const MessageSchema = z.object({
  id: z.string().optional(),
  // answers
  reverse_lookup_with_dicts: z
    .array(z.object({ outline: z.array(z.string()), dict_path: z.string() }))
    .optional(),
  lookup_from_all: z
    .array(z.object({ translation: z.string(), dict_path: z.string() }))
    .optional(),
  get_dictionaries: z
    .array(z.object({ path: z.string(), enabled: z.boolean() }))
    .optional(),
  get_config: z.object({ system_name: z.string() }).optional(),
  // events
  rtfcre: z.string().optional(),
  dictionaries_loaded: z.unknown(),
  config_changed: z.unknown(),
});
type Message = z.infer<typeof MessageSchema>;

const [isPloverConnected, setConnected] = createSignal(false);
const [getPloverSystem, setSystem] = createSignal<string>();
/**
 * Paths of the enabled dictionaries, highest priority first. A new array
 * whenever Plover's dictionaries may answer differently.
 */
const [getPloverDictionaries, setDictionaries] = createSignal<string[]>([]);
const [getPloverUrl, setUrl] = createSignal(
  localStorage.getItem("ploverUrl") ?? DEFAULT_URL,
);

export type StrokeCounts = {
  /** strokes made, the undo strokes aside */
  strokes: number;
  /** undo strokes: each took one of `strokes` back */
  undone: number;
};
/** Strokes of the test, counted from startStrokeCount() on. */
const [getStrokeCounts, setStrokeCounts] = createSignal<StrokeCounts>({
  strokes: 0,
  undone: 0,
});
export type RecentStroke = { rtfcre: string; isUndo: boolean };
const TAPE_LENGTH = 8;
/** The last strokes of the test, newest last: what was actually hit. */
const [getRecentStrokes, setRecentStrokes] = createSignal<RecentStroke[]>([]);
export {
  isPloverConnected,
  getPloverSystem,
  getPloverDictionaries,
  getPloverUrl,
  getStrokeCounts,
  getRecentStrokes,
};

let socket: WebSocket | undefined;
let retryTimeout: ReturnType<typeof setTimeout> | undefined;
let retryMs = RETRY_MS;
// whether connectPlover() was the last call: a connection is wanted
let wanted = false;
// which count a stroke belongs to, 0: not counting
let countId = 1;
let nextCountId = 2;
let stopCountTimeout: ReturnType<typeof setTimeout> | undefined;
let nextId = 0;
const pending = new Map<string, (answer: Message) => void>();
const cache = new Map<string, Promise<RawOutline[]>>();
const translations = new Map<string, Promise<Translation | undefined>>();

/** What the stroke translates to: the highest priority dictionary's entry. */
async function translate(stroke: string): Promise<Translation | undefined> {
  let translation = translations.get(stroke);
  if (translation === undefined) {
    translation = query({ lookup_from_all: [stroke] }).then(
      (answer) => answer.lookup_from_all?.[0],
    );
    translations.set(stroke, translation);
  }
  return translation;
}

// reads its symbols once: replaced when the dictionaries change
let symbols = createSymbolLookup(translate);

/** Strokes of Emily's symbols writing a symbol. Empty while disconnected. */
export const lookupSymbol: SymbolLookup = async (symbol, spacing) =>
  symbols(symbol, spacing);

/** Resolves with an empty answer while disconnected. */
async function query(message: Record<string, unknown>): Promise<Message> {
  return new Promise((resolve) => {
    if (socket?.readyState !== WebSocket.OPEN) {
      resolve({});
      return;
    }
    const id = String(nextId++);
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, ...message }));
  });
}

/**
 * Re-reads Plover's system and dictionaries and drops the cached lookups.
 * Plover adds translations without telling: call before a new test.
 */
export async function refreshPlover(): Promise<void> {
  cache.clear();
  translations.clear();
  const answer = await query({ get_dictionaries: true, get_config: true });
  setSystem(answer.get_config?.system_name);
  setDictionaries(
    (answer.get_dictionaries ?? [])
      .filter((dict) => dict.enabled)
      .map((dict) => dict.path),
  );
}

/** Counts from zero: call when a test is ready. */
export function startStrokeCount(): void {
  clearTimeout(stopCountTimeout);
  countId = nextCountId++;
  setStrokeCounts({ strokes: 0, undone: 0 });
  setRecentStrokes([]);
}

/** Keeps the counts as they are: call when the test ends. */
export function stopStrokeCount(): void {
  clearTimeout(stopCountTimeout);
  stopCountTimeout = setTimeout(() => (countId = 0), COUNT_GRACE_MS);
}

async function countStroke(rtfcre: string): Promise<void> {
  const id = countId;
  if (id === 0) return;
  const translation = (await translate(rtfcre))?.translation;
  // the count restarted or stopped while Plover answered
  if (id !== countId) return;
  // undefined, * is Plover's built in undo
  const isUndo =
    translation === "=undo" || (translation === undefined && rtfcre === "*");
  setStrokeCounts((counts) =>
    isUndo
      ? { ...counts, undone: counts.undone + 1 }
      : { ...counts, strokes: counts.strokes + 1 },
  );
  setRecentStrokes((tape) => [...tape, { rtfcre, isUndo }].slice(-TAPE_LENGTH));
}

function onMessage(event: MessageEvent): void {
  const { data: message, error } = tryCatchSync(() =>
    parseWithSchema(String(event.data), MessageSchema),
  );
  if (error) {
    console.error("Unexpected message from Plover", error);
    return;
  }
  if (message.id !== undefined) {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
    return;
  }
  if (message.rtfcre !== undefined) void countStroke(message.rtfcre);
  if (
    message.dictionaries_loaded !== undefined ||
    message.config_changed !== undefined
  ) {
    symbols = createSymbolLookup(translate);
    void refreshPlover();
  }
}

function reset(): void {
  socket = undefined;
  setConnected(false);
  for (const resolve of pending.values()) resolve({});
  pending.clear();
  cache.clear();
  translations.clear();
  symbols = createSymbolLookup(translate);
}

/**
 * Connects and keeps reconnecting until disconnectPlover(), waiting longer
 * after each failure: the browser logs every one.
 */
export function connectPlover(): void {
  wanted = true;
  if (socket !== undefined) return;
  clearTimeout(retryTimeout);
  const { data: ws, error } = tryCatchSync(() => new WebSocket(getPloverUrl()));
  if (error) {
    console.error(`Invalid Plover address "${getPloverUrl()}"`, error);
    return;
  }
  socket = ws;
  ws.addEventListener("open", () => {
    retryMs = RETRY_MS;
    setConnected(true);
    void refreshPlover();
  });
  ws.addEventListener("message", onMessage);
  ws.addEventListener("close", () => {
    // disconnectPlover() or a newer connection took over
    if (socket !== ws) return;
    reset();
    retryTimeout = setTimeout(connectPlover, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  });
}

export function disconnectPlover(): void {
  wanted = false;
  clearTimeout(retryTimeout);
  const ws = socket;
  reset();
  ws?.close();
}

/** Tries again now instead of at the next retry. */
export function retryPlover(): void {
  if (!wanted || isPloverConnected()) return;
  disconnectPlover();
  retryMs = RETRY_MS;
  connectPlover();
}

/** Where the plugin listens. Empty: its default. Kept in localStorage. */
export function setPloverUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed === "" || trimmed === DEFAULT_URL) {
    localStorage.removeItem("ploverUrl");
  } else {
    localStorage.setItem("ploverUrl", trimmed);
  }
  setUrl(trimmed === "" ? DEFAULT_URL : trimmed);
  if (!wanted) return;
  disconnectPlover();
  retryMs = RETRY_MS;
  connectPlover();
}

/** Outlines writing `translation`, unranked. Empty while disconnected. */
export async function lookupOutlines(
  translation: string,
): Promise<RawOutline[]> {
  let outlines = cache.get(translation);
  if (outlines === undefined) {
    outlines = query({ reverse_lookup_with_dicts: translation }).then(
      (answer) => answer.reverse_lookup_with_dicts ?? [],
    );
    cache.set(translation, outlines);
  }
  return outlines;
}
