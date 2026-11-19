import type { Config } from "@monkeytype/schemas/configs";

import { createMemo, For, JSXElement, Show } from "solid-js";

import { configMetadata } from "../../config/metadata";
import { setConfig } from "../../config/setters";
import { getConfig } from "../../config/store";
import {
  getPloverDictionaries,
  getPloverSystem,
  getPloverUrl,
  isPloverConnected,
  retryPlover,
  setPloverUrl,
} from "../../steno/plover";
import { stenoConflicts, stenoSettings } from "../../steno/settings";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Fa } from "../common/Fa";

const PLOVER_URL = "https://github.com/openstenoproject/plover/releases";
const PLUGIN_BRANCH = "feat/query-response-and-engine-control";
const PLUGIN_REPO = "https://github.com/RAOEUS/plover_websocket_server";
const HINT_MODES = ["off", "text", "diagram"] as const;

/**
 * Everything steno in one place: the connection to Plover, steno mode and its
 * hints, and how to set Plover up while it isn't connected.
 */
export function StenoModal(): JSXElement {
  return (
    <AnimatedModal id="Steno" title="Steno" modalClass="max-w-3xl">
      <Status />
      <Conflicts />
      <Setting
        title="steno mode"
        description={configMetadata.stenoMode.description}
      >
        <For each={[true, false]}>
          {(value) => (
            <Button
              variant="button"
              class="px-6"
              text={value ? "on" : "off"}
              active={getConfig.stenoMode === value}
              onClick={() => setConfig("stenoMode", value)}
            />
          )}
        </For>
      </Setting>
      <Setting
        title="hints"
        description={configMetadata.stenoHints.description}
      >
        <For each={HINT_MODES}>
          {(value) => (
            <Button
              variant="button"
              class="px-6"
              text={value}
              active={getConfig.stenoHints === value}
              disabled={!getConfig.stenoMode}
              onClick={() => setConfig("stenoHints", value)}
            />
          )}
        </For>
      </Setting>
      <Show when={getConfig.stenoMode}>
        <Setting
          title="plover address"
          description="Where the engine server plugin listens. Change it if you set another host or port in plover_engine_server_config.json. Empty: the default."
        >
          <input
            class="w-72"
            type="text"
            value={getPloverUrl()}
            onChange={(e) => setPloverUrl(e.currentTarget.value)}
          />
        </Setting>
      </Show>
      <Show when={getConfig.stenoMode && !isPloverConnected()}>
        <Setup />
      </Show>
    </AnimatedModal>
  );
}

function Status(): JSXElement {
  return (
    <div class="flex items-center gap-3 rounded-(--roundness) bg-sub-alt p-4">
      <Show
        when={getConfig.stenoMode}
        fallback={<span class="text-sub">Steno mode is off.</span>}
      >
        <Show
          when={isPloverConnected()}
          fallback={
            <>
              <Fa icon="fa-times" class="text-error" fixedWidth />
              <span>
                Plover isn&apos;t answering at{" "}
                <span class="text-sub">{getPloverUrl()}</span>. Set it up with
                the steps below: this page keeps trying and connects by itself.
              </span>
              <Button
                variant="button"
                class="px-4 whitespace-nowrap"
                text="retry now"
                onClick={retryPlover}
              />
            </>
          }
        >
          <Fa icon="fa-check" class="text-main" fixedWidth />
          <span>
            Connected to Plover, system{" "}
            <span class="text-main">{getPloverSystem() ?? "unknown"}</span>,{" "}
            {getPloverDictionaries().length} dictionaries enabled. Hints follow
            your dictionary order.
          </span>
        </Show>
      </Show>
    </div>
  );
}

/** Settings in the way of Plover's corrections, with the way out. */
function Conflicts(): JSXElement {
  const conflicts = createMemo(() =>
    getConfig.stenoMode ? stenoConflicts(getConfig) : [],
  );
  const fix = (): void => {
    const needed = stenoSettings(getConfig);
    for (const key of conflicts()) {
      setConfig(key, needed[key] as Config[typeof key]);
    }
  };
  return (
    <Show when={conflicts().length > 0}>
      <div class="flex items-center gap-3 rounded-(--roundness) bg-sub-alt p-4">
        <Fa icon="fa-exclamation-triangle" class="text-error" fixedWidth />
        <span>
          These settings get in the way of Plover&apos;s corrections:{" "}
          <span class="text-main">
            {conflicts()
              .map((key) => configMetadata[key].displayString ?? key)
              .join(", ")}
          </span>
          . An undo stroke or a multi stroke outline can leave the test out of
          step with Plover, and every stroke after it lands wrong.
        </span>
        <Button
          variant="button"
          class="px-4 whitespace-nowrap"
          text="fix them"
          onClick={fix}
        />
      </div>
    </Show>
  );
}

function Setting(props: {
  title: string;
  description: JSXElement;
  children: JSXElement;
}): JSXElement {
  return (
    <div class="grid gap-2">
      <div class="text-sub">{props.title}</div>
      <div class="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
        <div class="text-sm">{props.description}</div>
        <div class="flex gap-2">{props.children}</div>
      </div>
    </div>
  );
}

function Setup(): JSXElement {
  return (
    <div class="grid gap-3">
      <div class="text-sub">set up Plover</div>
      <ol class="grid list-decimal gap-3 pl-6 text-sm">
        <li>
          Install Plover 4 or newer, if you haven&apos;t.
          <Button
            variant="text"
            class="ml-2 inline-flex p-0"
            href={PLOVER_URL}
            text="downloads"
            fa={{ icon: "fa-external-link-alt" }}
          />
        </li>
        <li>
          Get the engine server plugin. It has to be this fork: the Plugin
          Manager&apos;s plover-engine-server-2 can&apos;t answer lookups.
          <Button
            variant="text"
            class="ml-2 inline-flex p-0"
            href={`${PLUGIN_REPO}/tree/${PLUGIN_BRANCH}`}
            text="repository"
            fa={{ icon: "fa-code-branch" }}
          />
          <Command>{`git clone -b ${PLUGIN_BRANCH} ${PLUGIN_REPO}`}</Command>
        </li>
        <li>
          Install it into Plover, from the folder you cloned in.
          <Command>
            plover -s plover_plugins install -e plover_websocket_server
          </Command>
          <span class="text-sub">
            No plover command? Use Plover&apos;s own executable in its place:
            plover_console.exe on Windows, the AppImage on Linux,
            /Applications/Plover.app/Contents/MacOS/Plover on macOS.
          </span>
        </li>
        <li>
          Restart Plover, open Configure, then Plugins, and enable
          plover_engine_server.
        </li>
        <li>
          Keep Plover running. The line at the top turns to connected by itself,
          or at once when you press retry now.
        </li>
      </ol>
    </div>
  );
}

/** A command to copy: clicking selects all of it. Wraps, so it never widens the modal. */
function Command(props: { children: string }): JSXElement {
  return (
    <code
      class={cn(
        "my-2 block rounded-(--roundness) bg-sub-alt px-3 py-2",
        "break-all text-text select-all",
      )}
    >
      {props.children}
    </code>
  );
}
