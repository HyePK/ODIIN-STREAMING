import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../app/odiin-app.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("ODIIN player keeps cross-browser HLS support wired", () => {
  assert.equal(typeof packageJson.dependencies?.["hls.js"], "string");
  assert.match(appSource, /import Hls from "hls\.js"/);
  assert.match(appSource, /\.m3u8/);
  assert.match(appSource, /Hls\.isSupported\(\)/);
  assert.match(appSource, /hls\.loadSource\(src\)/);
  assert.match(appSource, /hls\.attachMedia\(video\)/);
});

test("ODIIN playback controls auto-hide after five seconds and return on interaction", () => {
  assert.match(appSource, /setTimeout\(\(\) => setControlsVisible\(false\), 5000\)/);
  assert.match(appSource, /onTouchStart=\{showControls\}/);
  assert.match(appSource, /onMouseMove=\{showControls\}/);
  assert.match(appSource, /onClick=\{showControls\}/);
  assert.match(cssSource, /\.video-controls\.is-hidden/);
  assert.match(cssSource, /pointer-events:\s*none/);
});

test("ODIIN direct player exposes required playback controls", () => {
  assert.match(appSource, /aria-label="Seek video"/);
  assert.match(appSource, /aria-label="Rewind 10 seconds"/);
  assert.match(appSource, /aria-label="Forward 10 seconds"/);
  assert.match(appSource, /aria-label=\{muted \? "Unmute" : "Mute"\}/);
  assert.match(appSource, /aria-label="Volume"/);
  assert.match(appSource, /aria-label="Full screen"/);
});

test("Play now and card selections route through the autoplay/fullscreen path", () => {
  assert.match(appSource, /> Play now<\/Button>/);
  assert.match(appSource, /requestOdiinFullscreen\(\)/);
  assert.match(appSource, /setPlayRequest\(\(value\) => value \+ 1\)/);
  assert.match(appSource, /video\.play\(\)/);
  assert.match(appSource, /streamUrl \? \(/);
  assert.match(appSource, /<OdiinVideo src=\{streamUrl\}/);
});
