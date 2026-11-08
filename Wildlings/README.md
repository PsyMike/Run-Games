# Wildlings

A small, local, mobile-first Warden movement and animation test built with TypeScript, Vite, and PixiJS 8.

Repository: [PsyMike/Run-Games](https://github.com/PsyMike/Run-Games), in the `Wildlings/` subfolder. Run the commands below from the repository root after checking out a branch containing this project.

**Artwork is pending.** No reference image was present in the supplied workspace. Please upload the original Warden reference before implementing the final character animations. The current reticle is explicitly a position marker, not character art. No primitive-shape Warden has been created.

The planned Warden has blond hair, blue-and-gold armour, a red cape, and a sword. The palette in the inspector is a design note, not an interpretation of the missing artwork.

## Run locally

Requires Node.js 20.19+ or 22.12+ (tested here with Node 24).

```sh
cd Wildlings
npm ci
npm run dev
```

Open `http://localhost:5173`. The dev command listens on `0.0.0.0`, uses port 5173, and fails clearly if that port is occupied.

```sh
npm test          # Controller, manifest validation, frame selection
npm run build    # Strict TypeScript check and production bundle
npm run preview  # Serve the built bundle on port 4173
```

No RUN SDK, Playground integration, login, API calls, generation, game record, or deployment is included. This project does not spend RUN credits. Installing npm packages and running these commands do not publish the project.

## Open on Android

The simplest local route is to run the project **on your own computer**:

1. Connect your computer and Android phone to the same Wi-Fi.
2. Run `npm ci`, then `npm run dev` in this folder.
3. Vite prints a **Network** URL such as `http://192.168.1.23:5173`. Open that actual URL in Android Chrome. Do not enter `0.0.0.0` or your computer's `localhost` on the phone.
4. If needed, allow the development server through your computer's firewall for your private network. Guest Wi-Fi may isolate devices.

USB alternative, with Android platform tools installed and USB debugging authorized:

```sh
adb reverse tcp:5173 tcp:5173
```

With the dev server running on your computer, open `http://localhost:5173` in Android Chrome. To test the production preview instead, use port 4173 in both the reverse command and URL.

**This workspace runs in a cloud environment.** Its private container IP is not on your phone's Wi-Fi. Copy/download this folder to your computer for the steps above. If your environment offers authenticated preview/port forwarding, forward port 5173 and use the URL it actually provides; no such phone-accessible URL has been established by this project. A RUN deployment is not needed for local phone testing.

See [official RUN phone/LAN guidance](https://series-1.gitbook.io/rundot-docs/readme/playground#test-on-a-phone-or-lan-device).

## Controls and behavior

| Input                            | Action                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| Left thumb stick / WASD / arrows | Analog movement with eight-way facing                                  |
| Attack / J / Space               | Committed 0.42 s strike; movement and facing lock                      |
| Dodge / K / Shift                | Committed 0.30 s step in movement direction, or current facing at rest |
| Pause                            | Freeze and resume the simulation                                       |
| Reset                            | Recenter and return to south-facing rest                               |

Movement and action work simultaneously with separate fingers. Pointer release, pointer cancellation, lost capture, hidden tabs, focus loss, and opening field notes clear input. Actions do not queue or interrupt each other. Normal movement is 125 logical px/s; dodge is 400 px/s. Timesteps are capped at 50 ms after stalls so the character does not teleport on resume. Walk is a looping state; idle holds the first walk frame. The ring around the reticle displays action timing, not a final character animation.

The canvas follows its container through `ResizeObserver`, caps pixel ratio at 2, and bounds the character within the ground. Rotate the phone to check the responsive layout; the page may scroll to show secondary character notes while the movement controls remain together beneath the scene.

## Add the real sprites later

See [the Warden asset contract](public/assets/warden/README.md). It describes transparent atlas assets, a shared foot pivot, all eight directions, and the walk/attack/dodge clip manifest. No direction is silently mirrored, which preserves sword and armour handedness.

The default `WARDEN_MANIFEST_PATH = null` in `src/assets/config.ts` deliberately makes no asset requests. After approved assets are prepared, set that path to `assets/warden/manifest.json`. The loader validates the manifest and every named atlas frame before displaying the sprites. A missing or malformed opted-in asset leaves the movement marker usable and displays an error in the inspector.

One-shot attack and dodge frames follow normalized controller progress, so the whole clip fits the action duration (`WARDEN_TIMING` in `src/game/controller.ts`). Walk follows its manifest frame rate. Final action timings can be tuned to the approved animation assets. Do not treat a single reference illustration as a finished animation sheet.

## Structure

```text
src/game/controller.ts  Pure movement, facing, bounds, action clock
src/game/types.ts       Shared state and direction contracts
src/game/scene.ts       Pixi lifecycle, neutral ground, position marker
src/input/controls.ts   Pointer, multitouch, keyboard, input cleanup
src/assets/             Opt-in sprite loader, validation, frame selection
src/main.ts             Interface and live state inspector
src/style.css           Responsive layout and touch controls
tests/                  Logic tests and optional browser smoke checks
```

## Guidance inspected

The initial `/workspace` contained no source checkout, readable Git repository, local instructions, artwork, or RUN skills. Wildlings is kept in its own subfolder in `PsyMike/Run-Games` so it can be developed independently of other games.

Official RUN CLI v7.21.0's embedded `rundot-new-game`, `rundot-polish-feel`, mobile web guidance, and relevant CLI guidance were inspected read-only without logging in. The implementation applies strict TypeScript, PixiJS 8, Vite relative paths, ES2022 output, container resizing, a DPR cap, safe-area padding, clear touch targets, and input cancellation. The starter's SDK/Playground/deployment steps were omitted to respect the requested local-only scope.

- [Official RUN getting started](https://series-1.gitbook.io/rundot-docs/readme/getting-started)
- [Official RUN CLI and skills catalog](https://github.com/series-ai/rundot-cli-releases#skills-commands)
- [Official RUN Playground documentation](https://series-1.gitbook.io/rundot-docs/readme/playground) — Playground login can create a game record; this project does not include it.

## Optional browser smoke check

The environment check script uses Playwright and system Chromium. It is separate from `npm test`, so a clean installation does not download a browser. With Vite running, use `node tests/browser-smoke.mjs`; its environment dependencies and optional overrides are documented at the top of that file. It tests browser controls and responsive geometry; real Android hardware performance still needs testing on the phone.
