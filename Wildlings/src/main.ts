import "./style.css";
import { Controls } from "./input/controls";
import { createScene } from "./game/scene";
import type { CharacterSnapshot } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Wildlings home"><span class="brand-mark">w.</span><span>WILDLINGS<span class="brand-caption">A SMALL WORLD IN THE MAKING</span></span></a>
      <span class="build-label"><i></i> LOCAL PROTOTYPE <span> / 001</span></span>
    </header>

    <section class="introduction" aria-labelledby="page-title">
      <div><p class="eyebrow">CHARACTER STUDIES <span> / </span> MOVEMENT LAB</p><h1 id="page-title">Meet the Warden<span>.</span></h1><p class="intro-copy">A little hero. A first step.</p></div>
      <button class="notes-button" id="notes-open"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg> Field notes</button>
    </section>

    <div class="workspace">
      <section class="test-panel" aria-label="Interactive Warden movement test">
        <div class="scene-heading"><span><i class="live-dot"></i> TRAINING GROUND</span><div><span class="scene-scale">01 / NEUTRAL TERRAIN</span><button id="pause" class="icon-button" aria-label="Pause simulation" title="Pause simulation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button><button id="reset" class="icon-button" aria-label="Reset position" title="Reset position"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10a7 7 0 1 0 3-4M5 4v6h6"/></svg></button></div></div>
        <div id="scene" class="scene" role="img" aria-label="Neutral training ground. A position marker represents the Warden until reference artwork is supplied.">
          <span class="compass" aria-hidden="true">N<span>↑</span></span>
          <div class="scene-annotation"><span class="annotation-line"></span><span id="canvas-caption">WARDEN POSITION <small>Character artwork pending</small></span></div>
          <span class="terrain-note" aria-hidden="true">THE CLEARING</span>
          <div class="scene-error" id="scene-error" hidden></div>
          <div id="paused-label" class="paused-label" hidden>Simulation paused</div>
        </div>
        <div class="scene-readout"><span><span class="readout-dot"></span><span id="state-readout">IDLE</span><span class="readout-divider">/</span><span id="facing-readout">SOUTH</span></span><span id="coordinates">X 000 · Y 000</span></div>
        <div class="control-deck">
          <div class="movement-control"><div class="joystick" id="joystick" role="group" aria-label="Drag to move. Keyboard: WASD or arrow keys."><span class="joystick-axis horizontal"></span><span class="joystick-axis vertical"></span><div class="joystick-stick" id="stick"><span>✣</span></div></div><span class="control-caption">MOVE <kbd>W A S D</kbd></span></div>
          <div class="control-hint"><span>Find your footing.</span><p>Move, strike, slip away.</p></div>
          <div class="actions"><div><button id="dodge" class="action-button dodge" aria-label="Dodge. Keyboard: K or Shift."><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 20h14M15 12l8 8-8 8M6 8h11M4 13h7"/></svg><span>Dodge</span></button><span class="control-caption"><kbd>K</kbd> <span>/ SHIFT</span></span></div><div><button id="attack" class="action-button attack" aria-label="Attack. Keyboard: J or Space."><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m11 22 13-15 2-1v4L14 24M8 18l9 9M12 22l-6 6M5 25l3 4"/></svg><span>Attack</span></button><span class="control-caption"><kbd>J</kbd> <span>/ SPACE</span></span></div></div>
        </div>
      </section>

      <aside class="inspector" aria-label="Character and animation information">
        <div class="character-heading"><span class="eyebrow">YOUR CHARACTER</span><span class="character-number">No. 001</span></div>
        <h2>The Warden</h2><p class="character-copy">Small in stature.<br>Steadfast in spirit.</p>
        <div class="palette" aria-label="Planned character colors: blond hair, blue and gold armour, red cape"><i class="swatch blond"></i><i class="swatch blue"></i><i class="swatch gold"></i><i class="swatch red"></i><span>THE WARDEN’S COLOURS</span></div>
        <div class="art-status"><span class="status-symbol" aria-hidden="true">◇</span><div><strong id="asset-title">Awaiting reference artwork</strong><p id="asset-description">The marker tests movement only. Upload the Warden reference to begin the character animations.</p></div></div>
        <div class="animation-heading"><h3>Animation states</h3><span>03</span></div>
        <ol class="state-list">
          <li data-state="walk"><span class="state-number">01</span><div><strong>Walk</strong><span>Eight directions · looping</span></div><span class="state-indicator">—</span></li>
          <li data-state="attack"><span class="state-number">02</span><div><strong>Attack</strong><span>Plant your feet · strike</span></div><span class="state-indicator">—</span></li>
          <li data-state="dodge"><span class="state-number">03</span><div><strong>Dodge</strong><span>Quick step · recover</span></div><span class="state-indicator">—</span></li>
        </ol>
        <div class="take-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v12h13m-5-5 5 5-5 5"/></svg><p>Movement & timing are live.<br>Final sprite animations are pending.</p></div>
        <div class="inspector-footer"><span>FACING</span><strong id="direction-detail">↓ South</strong><span id="action-detail">Ready</span></div>
      </aside>
    </div>
    <footer class="page-footer"><span>WILDLINGS <span class="footer-separator">/</span> A WORK IN PROGRESS</span><span>BUILT FOR SMALL SCREENS & BIG ADVENTURES</span></footer>
  </main>
  <dialog id="notes" aria-labelledby="notes-title">
    <div class="notes-top"><span class="eyebrow">FIELD NOTES / 001</span><button id="notes-close" class="icon-button" aria-label="Close field notes">×</button></div>
    <h2 id="notes-title">A first step.</h2><p>This is a local movement and animation test. The reticle is a position marker, not Warden artwork.</p>
    <h3>Try the controls</h3><p>Drag the left stick to move. Use Attack or Dodge with another finger. On a keyboard, use WASD or arrows, J / Space to attack, and K / Shift to dodge.</p>
    <h3>Next: the Warden</h3><p>Upload the original reference artwork: blond hair, blue-and-gold armour, red cape, and sword. Final animation needs transparent, aligned walk, attack, and dodge frames for each direction.</p>
    <p class="notes-foot">See the project README for the sprite contract and Android preview instructions.</p>
  </dialog>
`;

const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const notes = get<HTMLDialogElement>("notes");
get("notes-open").addEventListener("click", () => notes.showModal());
get("notes-close").addEventListener("click", () => notes.close());
notes.addEventListener("click", (event) => {
  if (
    event.target === notes &&
    (event.clientX < notes.getBoundingClientRect().left ||
      event.clientX > notes.getBoundingClientRect().right ||
      event.clientY < notes.getBoundingClientRect().top ||
      event.clientY > notes.getBoundingClientRect().bottom)
  )
    notes.close();
});

const arrows: Record<CharacterSnapshot["facing"], string> = {
  south: "↓",
  "south-west": "↙",
  west: "←",
  "north-west": "↖",
  north: "↑",
  "north-east": "↗",
  east: "→",
  "south-east": "↘",
};
let lastUI = 0;
function updateUI(snapshot: CharacterSnapshot) {
  const now = performance.now();
  if (now - lastUI < 65) return;
  lastUI = now;
  get("state-readout").textContent = snapshot.state.toUpperCase();
  get("facing-readout").textContent = snapshot.facing.toUpperCase();
  get("coordinates").textContent =
    `X ${Math.round(snapshot.position.x).toString().padStart(3, "0")} · Y ${Math.round(snapshot.position.y).toString().padStart(3, "0")}`;
  get("direction-detail").textContent =
    `${arrows[snapshot.facing]} ${snapshot.facing[0].toUpperCase()}${snapshot.facing.slice(1)}`;
  const busy = snapshot.state === "attack" || snapshot.state === "dodge";
  get("action-detail").textContent = busy ? "In action" : "Ready";
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-state]",
  )) {
    const active = element.dataset.state === snapshot.state;
    element.classList.toggle("active", active);
    element.querySelector(".state-indicator")!.textContent = active
      ? "LIVE"
      : "—";
  }
  for (const action of ["attack", "dodge"])
    get<HTMLButtonElement>(action).disabled = busy || paused || notes.open;
}

let paused = false;
async function start() {
  const scene = await createScene(get("scene"), updateUI);
  const controls = new Controls({
    joystick: get("joystick"),
    stick: get("stick"),
    attack: get("attack"),
    dodge: get("dodge"),
    onAction: (action) => {
      if (!paused && !notes.open) scene.requestAction(action);
    },
  });
  scene.setMovement(() => controls.movement());
  const syncPause = () => {
    const stopped = paused || notes.open || document.hidden;
    controls.clear();
    lastUI = 0;
    scene.setPaused(stopped);
    get("paused-label").hidden = !stopped;
  };
  get("pause").addEventListener("click", () => {
    paused = !paused;
    get("pause").innerHTML = paused
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';
    get("pause").setAttribute(
      "aria-label",
      paused ? "Resume simulation" : "Pause simulation",
    );
    get("pause").title = paused ? "Resume simulation" : "Pause simulation";
    syncPause();
  });
  get("reset").addEventListener("click", () => {
    controls.clear();
    scene.reset();
    lastUI = 0;
    updateUI(scene.snapshot());
  });
  notes.addEventListener("close", syncPause);
  get("notes-open").addEventListener("click", syncPause);
  document.addEventListener("visibilitychange", syncPause);
  if (scene.hasArtwork) {
    get("asset-title").textContent = "Warden sprite assets loaded";
    get("asset-description").textContent =
      "Transparent directional sprites are active. Test each action and facing.";
    get("canvas-caption").innerHTML =
      "THE WARDEN <small>Directional sprites active</small>";
    document.querySelector(".take-note p")!.textContent =
      "Directional sprite animations are active.";
  }
  if (scene.assetError) {
    get("asset-title").textContent = "Sprite assets could not load";
    get("asset-description").textContent = scene.assetError;
  }
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      controls.destroy();
      scene.destroy();
    }
  });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      controls.destroy();
      scene.destroy();
    });
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  get("scene-error").hidden = false;
  get("scene-error").textContent =
    `The renderer could not start: ${message}. Try Chrome with graphics acceleration enabled.`;
  get("state-readout").textContent = "RENDERER UNAVAILABLE";
  for (const id of ["pause", "reset", "attack", "dodge"])
    get<HTMLButtonElement>(id).disabled = true;
});
