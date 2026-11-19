import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Query = Record<string, unknown> & { id: string };

/** The plugin's side of the connection, driven by the test. */
class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Query[] = [];
  private answered = 0;

  constructor() {
    super();
    FakeSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Query);
  }
  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }
  receive(message: unknown): void {
    const data =
      typeof message === "string" ? message : JSON.stringify(message);
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  /** Answers the queries sent since the last call. */
  async answer(reply: (query: Query) => object): Promise<void> {
    for (const query of this.sent.slice(this.answered)) {
      this.receive({ id: query.id, ...reply(query) });
    }
    this.answered = this.sent.length;
    await vi.advanceTimersByTimeAsync(0);
  }
}
vi.stubGlobal("WebSocket", FakeSocket);

import {
  connectPlover,
  disconnectPlover,
  getPloverDictionaries,
  getPloverSystem,
  getRecentStrokes,
  getStrokeCounts,
  isPloverConnected,
  lookupOutlines,
  startStrokeCount,
  stopStrokeCount,
} from "../../src/ts/steno/plover";

const setup = {
  get_dictionaries: [
    { path: "/d/user.json", enabled: true },
    { path: "/d/off.json", enabled: false },
    { path: "/d/base.json", enabled: true },
  ],
  get_config: { system_name: "Lapwing", machine_type: "Gemini PR" },
};

function socket(): FakeSocket {
  return FakeSocket.instances[FakeSocket.instances.length - 1] as FakeSocket;
}

async function connect(): Promise<FakeSocket> {
  connectPlover();
  const ws = socket();
  ws.open();
  await ws.answer(() => setup);
  return ws;
}

/** Plover reports a stroke, then answers what it translates to. */
async function stroke(ws: FakeSocket, rtfcre: string): Promise<void> {
  ws.receive({ stroked: {}, rtfcre });
  await ws.answer(() => ({
    lookup_from_all:
      rtfcre === "*"
        ? [{ translation: "=undo", dict_path: "/d/base.json" }]
        : [],
  }));
}

describe("plover client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
  });
  afterEach(() => {
    disconnectPlover();
    vi.useRealTimers();
  });

  it("reads the system and the enabled dictionaries in order", async () => {
    await connect();
    expect(isPloverConnected()).toBe(true);
    expect(getPloverSystem()).toBe("Lapwing");
    expect(getPloverDictionaries()).toEqual(["/d/user.json", "/d/base.json"]);
  });

  it("answers lookups once, by id", async () => {
    const ws = await connect();
    const first = lookupOutlines("test");
    const other = lookupOutlines("the");
    const again = lookupOutlines("test");
    const asked = ws.sent.filter((q) => "reverse_lookup_with_dicts" in q);
    expect(asked.map((q) => q["reverse_lookup_with_dicts"])).toEqual([
      "test",
      "the",
    ]);

    // answered out of order
    await ws.answer((query) => ({
      reverse_lookup_with_dicts: [
        {
          outline: [
            query["reverse_lookup_with_dicts"] === "the" ? "-T" : "TEFT",
          ],
          dict_path: "/d/base.json",
        },
      ],
    }));
    expect((await first)[0]?.outline).toEqual(["TEFT"]);
    expect((await again)[0]?.outline).toEqual(["TEFT"]);
    expect((await other)[0]?.outline).toEqual(["-T"]);
  });

  it("answers nothing while disconnected, and what was asked when it drops", async () => {
    expect(await lookupOutlines("test")).toEqual([]);
    const ws = await connect();
    const pending = lookupOutlines("test");
    ws.close();
    expect(await pending).toEqual([]);
    expect(isPloverConnected()).toBe(false);
  });

  it("drops what it knew when the dictionaries change", async () => {
    const ws = await connect();
    void lookupOutlines("test");
    await ws.answer(() => ({ reverse_lookup_with_dicts: [] }));

    ws.receive({ dictionaries_loaded: true });
    await ws.answer(() => ({
      ...setup,
      get_dictionaries: [{ path: "/d/new.json", enabled: true }],
    }));
    expect(getPloverDictionaries()).toEqual(["/d/new.json"]);

    void lookupOutlines("test");
    expect(
      ws.sent.filter((q) => q["reverse_lookup_with_dicts"] === "test"),
    ).toHaveLength(2);
  });

  it("counts strokes and the undo strokes among them", async () => {
    const ws = await connect();
    startStrokeCount();
    await stroke(ws, "TEFL");
    await stroke(ws, "*");
    await stroke(ws, "TEFT");
    expect(getStrokeCounts()).toEqual({ strokes: 2, undone: 1 });
    expect(getRecentStrokes()).toEqual([
      { rtfcre: "TEFL", isUndo: false },
      { rtfcre: "*", isUndo: true },
      { rtfcre: "TEFT", isUndo: false },
    ]);

    startStrokeCount();
    expect(getStrokeCounts()).toEqual({ strokes: 0, undone: 0 });
    expect(getRecentStrokes()).toEqual([]);
  });

  it("counts the stroke that ends the test, and none after", async () => {
    const ws = await connect();
    startStrokeCount();
    await stroke(ws, "TEFT");
    stopStrokeCount();
    // Plover reports it after typing what ended the test
    await stroke(ws, "-T");
    expect(getStrokeCounts().strokes).toBe(2);

    await vi.advanceTimersByTimeAsync(300);
    await stroke(ws, "TEFT");
    expect(getStrokeCounts().strokes).toBe(2);
  });

  it("reconnects, waiting longer after each failure", async () => {
    await connect();
    socket().close();
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakeSocket.instances).toHaveLength(2);

    socket().close();
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakeSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakeSocket.instances).toHaveLength(3);

    // connected again: back to the short wait
    socket().open();
    await socket().answer(() => setup);
    socket().close();
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakeSocket.instances).toHaveLength(4);
  });

  it("stays disconnected after disconnectPlover", async () => {
    await connect();
    disconnectPlover();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(isPloverConnected()).toBe(false);
  });

  it("ignores messages it can't read", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ws = await connect();
    ws.receive("not json");
    ws.receive({ get_dictionaries: "nope" });
    expect(error).toHaveBeenCalledTimes(2);
    expect(isPloverConnected()).toBe(true);
    error.mockRestore();
  });
});
