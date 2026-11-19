# monkeysteno

A fork of [Monkeytype](https://github.com/monkeytypegame/monkeytype) for practising stenography with [Plover](https://www.openstenoproject.org/plover/).

It adds a **steno mode** that talks to the Plover running on your computer. The hints you see are answered by Plover itself, so they follow your system, your dictionaries and their order.

Steno mode is on by default. With it off, this is plain Monkeytype.

## What steno mode does

- **Stroke hints** under the test, for the word your next stroke writes: the outline, its alternatives, and a phrase brief when one covers the next words too. Shown as text, or drawn on a steno board.
- **Your dictionaries**: the active system, dictionary priority, overrides, disabled dictionaries and Python dictionaries (such as phrasing dictionaries) all apply, because Plover does the lookups.
- **Capitalization**: a cap, lower or caps stroke is shown when the word needs one, and left out where Plover capitalizes by itself after a full stop.
- **Punctuation and symbols**, including [Emily's symbols](https://github.com/EPLHREU/emily-symbols) with the spacing and capitalization the text needs.
- **Words without an entry** are split at hyphens and `'s`, then fingerspelled.
- **Accuracy that fits steno**: measured on the text as it stands. What the next stroke of an outline replaces is not an error.
- **Stroke stats** on the result (strokes, undone strokes, stroke accuracy, strokes per word), and a tape of your last strokes under the hints.
- **Settings that suit Plover**: steno mode turns freedom mode on, and confidence mode, strict space, stop on error and delete on error off. They would otherwise refuse or change the corrections Plover makes.

The `steno` button above the test opens its settings: steno mode on or off, hints as text, as a diagram or off, and the address Plover listens on.

## Setting up Plover

You need [Plover](https://github.com/openstenoproject/plover/releases) 4 or newer and the engine server plugin from [this fork](https://github.com/RAOEUS/plover_websocket_server/tree/feat/query-response-and-engine-control). The plugin of the same name in Plover's Plugin Manager cannot answer lookups.

1. Get the plugin and install it into Plover:

   ```
   git clone -b feat/query-response-and-engine-control https://github.com/RAOEUS/plover_websocket_server
   plover -s plover_plugins install -e plover_websocket_server
   ```

   No `plover` command? Use Plover's own executable in its place: `plover_console.exe` on Windows, the AppImage on Linux, `/Applications/Plover.app/Contents/MacOS/Plover` on macOS.

2. Restart Plover, open Configure, then Plugins, and enable `plover_engine_server`.
3. Keep Plover running and open the page. It connects by itself. If Plover does not answer, these steps come up in the page.

The connection is made **from your browser** to `ws://localhost:8086/websocket`. Plover has to run on the computer you type on, wherever the page itself is hosted. To change system or dictionaries, change them in Plover: the page follows.

The plugin accepts connections from any page open in your browser and has no password by default. Keep that in mind on a shared computer.

## Running it

For development you need Node.js and pnpm in the versions [CONTRIBUTING_ADVANCED.md](./docs/CONTRIBUTING_ADVANCED.md#nodejs-and-pnpm) names, then:

```
pnpm install
cp frontend/src/ts/constants/firebase-config-example.ts frontend/src/ts/constants/firebase-config.ts
pnpm dev-fe
```

The page is at http://localhost:3000. No backend or Firebase project is needed to type and get hints.

To host it, build the images from this repository instead of pulling Monkeytype's (commands in [docker/BUILD.md](./docker/BUILD.md)), then follow [SELF_HOSTING.md](./docs/SELF_HOSTING.md). Its compose file uses the same image names, so it picks up the ones you built.

- Anywhere but `localhost`, the page has to be served over HTTPS, as SELF_HOSTING.md explains.
- From an HTTPS page, the browser still has to be allowed to reach `ws://localhost`. Browsers treat this differently, and some ask for permission to reach devices on your local network. If the page stays on "plover not connected" while Plover runs, look there first.

## Limits

- The board diagram draws the English stenotype layout (English Stenotype, Lapwing). Strokes with other keys are shown as text.
- A word without an entry is not broken into prefix and suffix strokes.
- Emily's symbols are found under their default `SKWH` starter only.

---

What follows is Monkeytype's own readme.

[![](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/static/images/githubbanner2.png?raw=true)](https://monkeytype.com/)
<br />

[![AnimeJs](https://img.shields.io/badge/Anime.js-ff4b4b?style=for-the-badge&logo=animedotjs&logoColor=white)](https://animejs.com/)&nbsp;
[![ChartJs](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)&nbsp;
[![Eslint](https://img.shields.io/badge/eslint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org/)&nbsp;
[![Express](https://img.shields.io/badge/-Express-373737?style=for-the-badge&logo=Express&logoColor=white)](https://expressjs.com/)&nbsp;
[![Firebase](https://img.shields.io/badge/firebase-DD2C00?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)&nbsp;
[![Fontawesome](https://img.shields.io/badge/fontawesome-538DD7?style=for-the-badge&logo=fontawesome&logoColor=white)](https://fontawesome.com/)&nbsp;
[![HTML5](https://img.shields.io/badge/html5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)&nbsp;
[![MongoDB](https://img.shields.io/badge/-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)&nbsp;
[![OXLint](https://img.shields.io/badge/oxlint-2b3c5a?style=for-the-badge&logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/linter.html)&nbsp;
[![PNPM](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)&nbsp;
[![Redis](https://img.shields.io/badge/Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)&nbsp;
[![SASS](https://img.shields.io/badge/SASS-CC6699?style=for-the-badge&logo=SASS&logoColor=white)](https://sass-lang.com/)&nbsp;
[![Solid](https://img.shields.io/badge/solid-2C4F7C?style=for-the-badge&logo=solid&logoColor=white)](https://www.solidjs.com/)&nbsp;
[![Tailwind](https://img.shields.io/badge/tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)&nbsp;
[![Tanstack](https://img.shields.io/badge/Tanstack-EDE8D1?style=for-the-badge&logo=tanstack&logoColor=3A3A38)](https://tanstack.com/)&nbsp;
[![TsRest](https://img.shields.io/badge/-TSREST-9333ea?style=for-the-badge&logoColor=white&logo=data:image/svg%2bxml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB3aWR0aD0iMjAuMzA2Nzc4bW0iCiAgIGhlaWdodD0iMTIuMDgzMjMzbW0iCiAgIHZpZXdCb3g9IjAgMCAyMC4zMDY3NzggMTIuMDgzMjMzIgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0ibmFtZWR2aWV3MSIKICAgICBwYWdlY29sb3I9IiM1MDUwNTAiCiAgICAgYm9yZGVyY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMSIKICAgICBpbmtzY2FwZTpzaG93cGFnZXNoYWRvdz0iMCIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMCIKICAgICBpbmtzY2FwZTpwYWdlY2hlY2tlcmJvYXJkPSIxIgogICAgIGlua3NjYXBlOmRlc2tjb2xvcj0iI2QxZDFkMSIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0ibW0iIC8+CiAgPGRlZnMKICAgICBpZD0iZGVmczEiIC8+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTMuODE5ODA1NCwtMi4yMTQ3MTkzKSI+CiAgICA8cGF0aAogICAgICAgZD0ibSAxNS40NTgwMzUsOC45NzMzOTUzIDguNjMzMjUsMC4wNDQ4NyAwLjAwOSwtMS42NjgxOTggLTguNjMzMjIsLTAuMDQ0ODUgeiBtIDAuMDI2MywtNS4wNTYxMDggOC42MzMyNSwwLjA0NDg1IDAuMDA5LC0xLjcwMjU2OCAtOC42MzMyNSwtMC4wNDQ4NSB6IG0gLTAuMDQ0OCw4LjYzMzI0NzcgOC42MzMyMywwLjA0NDg1IC0wLjAwOSwxLjcwMjU2NyAtOC42MzMyNSwtMC4wNDQ4NSB6IgogICAgICAgZmlsbD0iI2ZmZmZmZiIKICAgICAgIGlkPSJwYXRoMSIKICAgICAgIHN0eWxlPSJzdHJva2Utd2lkdGg6MC4yNjQ1ODMiIC8+CiAgICA8cGF0aAogICAgICAgZD0ibSAxMS4xMTE3MjUsMTAuMjg2NjI4IGMgMS42NTEsLTAuNjE5MTI0NyAyLjU5Njg4LC0xLjk2MDU2MjcgMi41OTY4OCwtMy44MDA3Mzk3IDAsLTIuNjQ4NDc5IC0xLjkyNjE2LC00LjI0Nzg4NSAtNS4wNzMzNzk2LC00LjI0Nzg4NSBoIC00LjgxNTQyIHYgMS43MDI1OTQgaCA0Ljc0NjYzIGMgMi4wODA5Mzk2LDAgMy4xNjQ0MDk2LDAuOTI4Njg3IDMuMTY0NDA5NiwyLjU0NTI5MSAwLDEuNTk5NDA2IC0xLjA4MzQ3LDIuNTQ1MjkyIC0zLjE2NDQwOTYsMi41NDUyOTIgaCAtNC43NDY2MyB2IDUuMjQ1MzYzNyBoIDEuOTYwNTYgdiAtMy41NzcxNjYgaCAyLjg1NDg2IGMgMC4yMDYzNywwIDAuNDI5OTUsMCAwLjYxOTEyLC0wLjAxNzIgbCAyLjUyODA5OTYsMy41OTQzNjQgaCAyLjEzMjU0IHoiCiAgICAgICBmaWxsPSIjZmZmZmZmIgogICAgICAgaWQ9InBhdGgyIgogICAgICAgc3R5bGU9InN0cm9rZS13aWR0aDowLjI2NDU4MyIgLz4KICA8L2c+Cjwvc3ZnPgo=)](https://ts-rest.com/)
[![Turborepo](https://img.shields.io/badge/-Turborepo-FF1E56?style=for-the-badge&logo=turborepo&logoColor=white)](https://turborepo.org/)&nbsp;
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)&nbsp;
[![Vite](https://img.shields.io/badge/Vite-9135FF?style=for-the-badge&logo=Vite&logoColor=white)](https://vitejs.dev/)&nbsp;
[![Vitest](https://img.shields.io/badge/vitest-00FF74?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)&nbsp;
[![Zod](https://img.shields.io/badge/-Zod-408AFF?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)

# About

Monkeytype is a minimalistic and customizable [typing test](https://www.monkeytype.com). It features many test modes, an account system to save your typing speed history, and user-configurable features such as themes, sounds, a smooth caret, and more. Monkeytype attempts to emulate a natural typing experience during a typing test by unobtrusively presenting the text prompts and displaying typed characters in place, providing straightforward, real-time feedback on typos, speed, and accuracy.

# Features

- Minimalistic design, with optional advertisements and focus mode while typing
- Type what you see, see what you type
- Live errors, wpm, and accuracy displays
- A variety of test lengths and languages
- Punctuation and numbers modes
- Quotes
- Themes
- Smooth caret
- Account system
- Challenges and just-for-fun test modifiers
- And much more

# Discord bot

On the [Monkeytype Discord server](https://www.discord.gg/monkeytype), we added a Discord bot to auto-assign optional roles based on typing performance and challenge completion. You can find its code over at https://github.com/monkeytypegame/monkeytype-bot.

# Bug report or Feature request

If you encounter a bug or have a feature request, [send us an email](mailto:contact@monkeytype.com), [create an issue](https://github.com/monkeytypegame/monkeytype/issues), [create a discussion thread](https://github.com/monkeytypegame/monkeytype/discussions), or [join the Discord server](https://www.discord.gg/monkeytype).

# Want to Contribute?

Refer to [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

# Code of Conduct

Before contributing to this repository, please read the [code of conduct](./docs/CODE_OF_CONDUCT.md).

# Security

To report a security vulnerability, please refer to [SECURITY.md](./docs/SECURITY.md).

# Credits

[Montydrei](https://www.reddit.com/user/montydrei) for the name suggestion.

Everyone who provided valuable feedback on the [original Reddit post](https://www.reddit.com/r/MechanicalKeyboards/comments/gc6wx3/experimenting_with_a_completely_new_type_of/) for the prototype of this website.

All of the [contributors](https://github.com/monkeytypegame/monkeytype/graphs/contributors) have helped implement various features, add themes, fix bugs, and more.

# Support

If you wish to support further development and feel extra awesome, you can [donate](https://ko-fi.com/monkeytype), [become a Patron](https://www.patreon.com/monkeytype), or [buy a t-shirt](https://www.monkeytype.store/).
