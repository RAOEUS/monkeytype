// The English stenotype board (English Stenotype, Lapwing): which keys a
// stroke presses and where they sit.
// ponytail: one board. Systems with other keys (eg. extended ones with ^ and
// +) fall back to the stroke's text; read the keys from Plover's system to
// draw theirs.

// steno order: each key's index is its id
const KEYS = "#STKPWHRAO*EUFRPBLGTSDZ";
// the digit a key writes with the number bar, as outlines spell it
const DIGITS = " 12 3 4 50   6 7 8 9   ";
const FIRST_RIGHT_KEY = KEYS.indexOf("F");

/** In key units: 10 wide, 3.5 high (number bar, two rows, vowels). */
export type KeyShape = { x: number; y: number; width: number; height: number };

/** `row` 1 and 2: the banks, 3: the vowels, with nothing under the star. */
const bank = (column: number, row: number): KeyShape => ({
  x: column,
  y: row - 0.5,
  width: 1,
  height: 1,
});
const tall = (column: number): KeyShape => ({ ...bank(column, 1), height: 2 });

/** By key id (index in steno order). */
export const KEY_SHAPES: KeyShape[] = [
  { x: 0, y: 0, width: 10, height: 0.5 }, // #
  tall(0), // S-
  bank(1, 1), // T-
  bank(1, 2), // K-
  bank(2, 1), // P-
  bank(2, 2), // W-
  bank(3, 1), // H-
  bank(3, 2), // R-
  bank(2, 3), // A
  bank(3, 3), // O
  tall(4), // *
  bank(5, 3), // E
  bank(6, 3), // U
  bank(5, 1), // -F
  bank(5, 2), // -R
  bank(6, 1), // -P
  bank(6, 2), // -B
  bank(7, 1), // -L
  bank(7, 2), // -G
  bank(8, 1), // -T
  bank(8, 2), // -S
  bank(9, 1), // -D
  bank(9, 2), // -Z
];

/**
 * Ids of the keys `stroke` presses ("KW-BG", "#HROPBD", "1-9"). Undefined
 * when it isn't a stroke of this board.
 */
export function parseStroke(stroke: string): Set<number> | undefined {
  const pressed = new Set<number>();
  let next = 0;
  // oxlint-disable-next-line no-misused-spread -- keys are single code units
  for (const char of [...stroke]) {
    if (char === "-") {
      next = Math.max(next, FIRST_RIGHT_KEY);
      continue;
    }
    let key = -1;
    for (let i = next; i < KEYS.length; i++) {
      if (KEYS[i] === char || (char !== " " && DIGITS[i] === char)) {
        key = i;
        break;
      }
    }
    if (key === -1) return undefined;
    if (KEYS[key] !== char) pressed.add(0);
    pressed.add(key);
    next = key + 1;
  }
  return pressed.size === 0 ? undefined : pressed;
}
