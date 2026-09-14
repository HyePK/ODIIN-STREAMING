import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../lib/chunked-upload.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/media/[id]/route.ts", import.meta.url), "utf8");
const studio = await readFile(new URL("../app/studio/studio-client.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../app/odiin-app.tsx", import.meta.url), "utf8");
const events = await readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8");

test("browser uploader transfers exact 5 MB parts with progress and retry", () => {
  assert.match(client, /ODIIN_CHUNK_SIZE = 5 \* 1024 \* 1024/);
  assert.match(client, /new XMLHttpRequest\(\)/);
  assert.match(client, /xhr\.upload\.onprogress/);
  assert.match(client, /attempt <= 3/);
  assert.match(client, /method: "HEAD"/);
});

test("server uses resumable R2 multipart storage and retains failed records", () => {
  assert.match(route, /createMultipartUpload/);
  assert.match(route, /resumeMultipartUpload/);
  assert.match(route, /uploadPart/);
  assert.match(route, /complete\(parts\)/);
  assert.match(route, /status: "upload_failed"/);
  assert.match(app, /Upload needs retrying/);
  assert.match(events, /"uploading", "upload_failed"/);
});

test("creator and admin browser upload paths use the chunked transfer", () => {
  assert.match(studio, /uploadVideoInChunks/);
  assert.match(app, /uploadVideoInChunks/);
  assert.doesNotMatch(studio, /body: recording/);
  assert.doesNotMatch(app, /body: video,/);
});

test("permanent storage and byte-range playback are verified", () => {
  assert.match(route, /stored\.size !== Number\(body\.fileSize\)/);
  assert.match(route, /export async function HEAD/);
  assert.match(route, /status: range \? 206 : 200/);
  assert.match(route, /content-range/);
});
