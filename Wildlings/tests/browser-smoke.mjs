// Run against the local Vite server: node tests/browser-smoke.mjs
// Optional: WILDLINGS_URL, CHROMIUM_PATH. Install playwright-core locally if
// running outside the managed development environment.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let playwright;
try {
  playwright = await import('playwright-core');
} catch {
  try {
    playwright = await import('/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs');
  } catch {
    throw new Error('Browser checks require playwright-core. Install it locally, then rerun this script.');
  }
}

const url = process.env.WILDLINGS_URL || 'http://127.0.0.1:5173';
const results = fileURLToPath(new URL('../test-results/', import.meta.url));
await mkdir(results, { recursive: true });
const browser = await playwright.chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const failures = [];

function watchErrors(page, name) {
  page.on('pageerror', error => failures.push(`${name}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`${name}: ${message.text()}`);
  });
}

async function state(page, expected) {
  await page.waitForFunction(value => document.querySelector('#state-readout')?.textContent === value, expected, { timeout: 3000 });
}

async function coordinates(page) {
  const value = await page.locator('#coordinates').textContent();
  const match = value.match(/X\s+(-?\d+)\s+·\s+Y\s+(-?\d+)/);
  assert.ok(match, `Coordinates should be visible, received ${value}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function noOverflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
    canvasCount: document.querySelectorAll('#scene canvas').length,
    errorHidden: document.querySelector('#scene-error').hidden,
  }));
  assert.ok(layout.content <= layout.viewport, `${label}: horizontal overflow ${layout.content}/${layout.viewport}`);
  assert.equal(layout.canvasCount, 1, `${label}: one Pixi canvas`);
  assert.equal(layout.errorHidden, true, `${label}: renderer should start`);
}

async function open(context, label) {
  const page = await context.newPage();
  watchErrors(page, label);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#scene canvas');
  await state(page, 'IDLE');
  await noOverflow(page, label);
  return page;
}

async function reset(page) {
  await page.locator('#reset').click();
  await state(page, 'IDLE');
  assert.equal(await page.locator('#facing-readout').textContent(), 'SOUTH');
  const actual = await coordinates(page);
  const expected = await page.locator('#scene').evaluate(element => ({ x: Math.round(element.clientWidth / 2), y: Math.round(element.clientHeight / 2) }));
  assert.ok(Math.abs(actual.x - expected.x) <= 1 && Math.abs(actual.y - expected.y) <= 1, 'Reset centers the position marker');
}

async function desktopChecks() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await open(context, 'Desktop');
  const initial = await coordinates(page);
  await page.keyboard.down('KeyD');
  await state(page, 'WALK');
  await page.waitForTimeout(220);
  assert.equal(await page.locator('#facing-readout').textContent(), 'EAST');
  const moved = await coordinates(page);
  assert.ok(moved.x > initial.x + 10, 'Keyboard walk moves east');
  assert.ok(Math.abs(moved.y - initial.y) <= 1, 'East walk retains Y');
  await page.keyboard.up('KeyD');
  await state(page, 'IDLE');
  const released = await coordinates(page);
  await page.waitForTimeout(130);
  assert.deepEqual(await coordinates(page), released, 'Key release stops movement');

  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await state(page, 'WALK');
  await page.waitForFunction(() => document.querySelector('#facing-readout').textContent === 'NORTH-WEST');
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyA');
  await state(page, 'IDLE');

  await page.keyboard.down('KeyJ');
  await state(page, 'ATTACK');
  const attackPosition = await coordinates(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(100);
  assert.deepEqual(await coordinates(page), attackPosition, 'Attack locks movement');
  await page.keyboard.up('KeyD');
  await state(page, 'IDLE');
  await page.keyboard.down('KeyJ'); // A second down while held is a repeat.
  await page.waitForTimeout(140);
  assert.equal(await page.locator('#state-readout').textContent(), 'IDLE', 'Held attack does not repeat after recovery');
  await page.keyboard.up('KeyJ');

  await reset(page);
  const beforeDodge = await coordinates(page);
  await page.keyboard.down('KeyK');
  await state(page, 'DODGE');
  await state(page, 'IDLE');
  const afterDodge = await coordinates(page);
  assert.ok(afterDodge.y > beforeDodge.y + 70, 'Dodge travels in the current facing direction');
  await page.keyboard.down('KeyK');
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#state-readout').textContent(), 'IDLE', 'Held dodge does not repeat after recovery');
  await page.keyboard.up('KeyK');

  await page.locator('#pause').click();
  assert.equal(await page.locator('#paused-label').isVisible(), true);
  const pausedPosition = await coordinates(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(180);
  assert.deepEqual(await coordinates(page), pausedPosition, 'Pause freezes movement');
  await page.keyboard.up('KeyD');
  await page.locator('#pause').click();
  assert.equal(await page.locator('#paused-label').isHidden(), true);
  await page.keyboard.down('KeyA');
  await state(page, 'WALK');
  await page.keyboard.up('KeyA');
  await state(page, 'IDLE');
  await reset(page);

  await page.locator('#notes-open').click();
  assert.equal(await page.locator('#notes').isVisible(), true);
  assert.equal(await page.locator('#paused-label').isVisible(), true, 'Field notes pause the scene');
  await page.locator('#notes-close').click();
  assert.equal(await page.locator('#notes').isHidden(), true);
  await noOverflow(page, 'Desktop after interactions');
  await page.screenshot({ path: `${results}/desktop.png`, fullPage: true });
  await context.close();
  console.log('Desktop: keyboard, committed actions, recovery, pause/resume, reset, field notes, layout passed.');
}

async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'Control is visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
}

async function androidChecks() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const page = await open(context, 'Android');
  await page.locator('#joystick').scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(page);
  const joystick = await center(page.locator('#joystick'));
  const touch = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
  const stickPoint = touch(1, joystick.x + joystick.width * 0.3, joystick.y);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, joystick.x, joystick.y)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [stickPoint] });
  await state(page, 'WALK');
  assert.equal(await page.locator('#facing-readout').textContent(), 'EAST');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await state(page, 'IDLE');
  assert.equal(await page.locator('#joystick').evaluate(element => element.classList.contains('is-active')), false, 'Pointer cancel releases joystick');
  assert.equal(await page.locator('#stick').evaluate(element => element.style.transform), 'translate(0px, 0px)', 'Pointer cancel recenters stick');

  await reset(page);
  await page.locator('#joystick').scrollIntoViewIfNeeded();
  const joystick2 = await center(page.locator('#joystick'));
  const attack = await center(page.locator('#attack'));
  const movingPoint = touch(11, joystick2.x + joystick2.width * 0.3, joystick2.y);
  const attackPoint = touch(12, attack.x, attack.y);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(11, joystick2.x, joystick2.y)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [movingPoint] });
  await state(page, 'WALK');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [movingPoint, attackPoint] });
  await state(page, 'ATTACK');
  const locked = await coordinates(page);
  await page.waitForTimeout(100);
  assert.deepEqual(await coordinates(page), locked, 'Second-finger attack locks movement while joystick stays held');
  // CDP touchEnd identifies the points to END, rather than the points left down.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [attackPoint] });
  await state(page, 'WALK');
  const resumed = await coordinates(page);
  await page.waitForTimeout(120);
  assert.ok((await coordinates(page)).x > resumed.x, 'Held joystick resumes movement after attack');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await state(page, 'IDLE');

  await reset(page);
  const beforeDodge = await coordinates(page);
  await page.locator('#dodge').tap();
  await state(page, 'DODGE');
  await state(page, 'IDLE');
  assert.ok((await coordinates(page)).y > beforeDodge.y + 40, 'Touch dodge travels and recovers');
  await reset(page);
  await noOverflow(page, 'Android after multitouch');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(120);
  await noOverflow(page, 'Android narrow portrait');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(120);
  await noOverflow(page, 'Android landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  await reset(page);
  await page.screenshot({ path: `${results}/android.png`, fullPage: true });
  await cdp.detach();
  await context.close();
  console.log('Android: layout, joystick drag/cancel, simultaneous move and attack, touch dodge, reset passed.');
}

try {
  await desktopChecks();
  await androidChecks();
  assert.deepEqual(failures, [], 'No browser JavaScript or console errors');
  console.log(`Browser smoke checks passed. Screenshots: ${results}`);
} finally {
  await browser.close();
}
