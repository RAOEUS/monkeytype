import { For, JSXElement } from "solid-js";

import { KEY_SHAPES } from "../../../steno/board";
import { cn } from "../../../utils/cn";

// viewBox units per key unit, and the gap taken out of each key
const UNIT = 10;
const GAP = 1.5;

/**
 * A steno board with the `pressed` keys (ids of steno/board) lit. `dimmed`:
 * a stroke beside the word's (a mark, cap), smaller and in the text color.
 */
export function StenoBoard(props: {
  pressed: Set<number>;
  dimmed?: boolean;
}): JSXElement {
  return (
    <svg
      viewBox={`0 0 ${10 * UNIT - GAP} ${3.5 * UNIT - GAP}`}
      class={cn("w-auto", props.dimmed === true ? "h-[1.8em]" : "h-[2.4em]")}
      aria-hidden="true"
    >
      <For each={KEY_SHAPES}>
        {(shape, key) => (
          <rect
            x={shape.x * UNIT}
            y={shape.y * UNIT}
            width={shape.width * UNIT - GAP}
            height={shape.height * UNIT - GAP}
            rx="2"
            class={cn(
              "fill-sub-alt",
              props.pressed.has(key()) &&
                (props.dimmed === true ? "fill-text" : "fill-main"),
            )}
          ></rect>
        )}
      </For>
    </svg>
  );
}
