import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { accounts, events } from "../../../../db/schema";
import { hasAdminAccess } from "../../../admin-auth";

const CHUNK_SIZE = 5 * 1024 * 1024;
const UPLOAD_PREFIX = "r2-upload:";

function bucketFromEnv() {
  return (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
}

async function canWrite(request: Request, id: string) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (await hasAdminAccess(request.headers)) return true;
  if (!email) return false;
  const db = getDb();
  const [[account], [event]] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.email, email)).limit(1),
    db.select().from(events).where(and(eq(events.id, id), eq(events.creatorEmail, email))).limit(1),
  ]);
  return Boolean(account?.creatorAccess && account.subscriptionStatus === "active" && account.channelStatus !== "restricted" && event);
}

function validId(id: string) {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

function uploadIdFrom(value: string) {
  return value.startsWith(UPLOAD_PREFIX) ? value.slice(UPLOAD_PREFIX.length) : "";
}

async function eventFor(id: string) {
  const [event] = await getDb().select().from(events).where(eq(events.id, id)).limit(1);
  return event;
}

async function requireWrite(request: Request, id: string) {
  if (!validId(id)) return Response.json({ error: "Invalid broadcast id." }, { status: 400 });
  if (!await canWrite(request, id)) return Response.json({ error: "An active creator subscription is required." }, { status: 401 });
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const denied = await requireWrite(request, id);
  if (denied) return denied;
  const action = new URL(request.url).searchParams.get("action");
  const bucket = bucketFromEnv();
  if (!bucket) return Response.json({ error: "Video storage is unavailable." }, { status: 503 });

  try {
    const body = await request.json() as {
      fileName?: string; fileSize?: number; contentType?: string; totalParts?: number;
      uploadId?: string; parts?: Array<{ partNumber: number; etag: string }>; error?: string;
    };
    const event = await eventFor(id);
    if (!event) return Response.json({ error: "Broadcast was not found." }, { status: 404 });
    const key = `broadcasts/${id}`;

    if (action === "init") {
      const fileSize = Number(body.fileSize);
      const totalParts = Number(body.totalParts);
      const contentType = body.contentType || "video/mp4";
      if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > 20 * 1024 * 1024 * 1024) {
        return Response.json({ error: "Video size is invalid or exceeds 20 GB." }, { status: 400 });
      }
      if (!contentType.startsWith("video/")) return Response.json({ error: "The selected file must be a video." }, { status: 415 });
      if (totalParts !== Math.ceil(fileSize / CHUNK_SIZE)) return Response.json({ error: "Upload chunk count is invalid." }, { status: 400 });

      const previousId = uploadIdFrom(event.providerBroadcastId);
      if (previousId) await bucket.resumeMultipartUpload(key, previousId).abort().catch(() => undefined);
      const upload = await bucket.createMultipartUpload(key, {
        httpMetadata: { contentType, cacheControl: "private, max-age=0" },
        customMetadata: {
          originalName: (body.fileName || "recording").slice(0, 240),
          expectedSize: String(fileSize),
        },
      });
      await getDb().update(events).set({
        streamUrl: "", providerBroadcastId: `${UPLOAD_PREFIX}${upload.uploadId}`,
        status: "uploading", updatedAt: new Date().toISOString(),
      }).where(eq(events.id, id));
      return Response.json({ ok: true, uploadId: upload.uploadId, chunkSize: CHUNK_SIZE });
    }

    const uploadId = body.uploadId || "";
    if (!uploadId || event.providerBroadcastId !== `${UPLOAD_PREFIX}${uploadId}`) {
      return Response.json({ error: "Upload session is no longer active." }, { status: 409 });
    }

    if (action === "fail") {
      await getDb().update(events).set({ status: "upload_failed", updatedAt: new Date().toISOString() }).where(eq(events.id, id));
      return Response.json({ ok: true, retained: true });
    }

    if (action === "complete") {
      const parts = Array.isArray(body.parts) ? body.parts : [];
      if (!parts.length || parts.some((part, index) => part.partNumber !== index + 1 || !part.etag)) {
        return Response.json({ error: "Uploaded parts are incomplete." }, { status: 400 });
      }
      await bucket.resumeMultipartUpload(key, uploadId).complete(parts);
      const stored = await bucket.head(key);
      if (!stored || stored.size !== Number(body.fileSize)) {
        await getDb().update(events).set({ status: "upload_failed", updatedAt: new Date().toISOString() }).where(eq(events.id, id));
        return Response.json({ error: "Permanent storage verification failed. The record was retained." }, { status: 500 });
      }
      await getDb().update(events).set({
        streamUrl: `/api/media/${id}`, providerBroadcastId: "", status: "published", updatedAt: new Date().toISOString(),
      }).where(eq(events.id, id));
      return Response.json({ ok: true, streamUrl: `/api/media/${id}`, storedBytes: stored.size });
    }

    return Response.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Video upload failed." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const denied = await requireWrite(request, id);
  if (denied) return denied;
  const url = new URL(request.url);
  if (url.searchParams.get("action") !== "part") return Response.json({ error: "Use the ODIIN chunked uploader." }, { status: 400 });
  const uploadId = url.searchParams.get("uploadId") || "";
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 4000) {
    return Response.json({ error: "Invalid upload part." }, { status: 400 });
  }
  const event = await eventFor(id);
  if (!event || event.providerBroadcastId !== `${UPLOAD_PREFIX}${uploadId}`) {
    return Response.json({ error: "Upload session is no longer active." }, { status: 409 });
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > CHUNK_SIZE) {
    return Response.json({ error: "Each upload part must be 5 MB or smaller." }, { status: 413 });
  }
  const bucket = bucketFromEnv();
  if (!bucket) return Response.json({ error: "Video storage is unavailable." }, { status: 503 });
  try {
    const part = await bucket.resumeMultipartUpload(`broadcasts/${id}`, uploadId).uploadPart(partNumber, bytes);
    return Response.json({ ok: true, partNumber: part.partNumber, etag: part.etag });
  } catch (error) {
    await getDb().update(events).set({ status: "upload_failed", updatedAt: new Date().toISOString() }).where(eq(events.id, id));
    return Response.json({ error: error instanceof Error ? error.message : "Video chunk failed." }, { status: 500 });
  }
}

function parseRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(requestedEnd) || start < 0 || start >= size || requestedEnd < start) return null;
  const end = Math.min(requestedEnd, size - 1);
  return { offset: start, length: end - start + 1 };
}

export async function HEAD(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return new Response(null, { status: 404 });
  const object = await bucketFromEnv()?.head(`broadcasts/${id}`);
  if (!object) return new Response(null, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-length", String(object.size));
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=0");
  return new Response(null, { headers });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return new Response("Not found", { status: 404 });
  const bucket = bucketFromEnv();
  if (!bucket) return new Response("Video storage unavailable", { status: 503 });
  const key = `broadcasts/${id}`;
  const rangeHeader = request.headers.get("range");
  const head = rangeHeader ? await bucket.head(key) : null;
  if (rangeHeader && !head) return new Response("Video not found", { status: 404 });
  const range = rangeHeader && head ? parseRange(rangeHeader, head.size) : null;
  if (rangeHeader && !range) return new Response(null, { status: 416, headers: { "content-range": `bytes */${head!.size}` } });
  const object = await bucket.get(key, range ? { range } : undefined);
  if (!object) return new Response("Video not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=0");
  if (range && head) {
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    headers.set("content-length", String(range.length));
  } else {
    headers.set("content-length", String(object.size));
  }
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const denied = await requireWrite(request, id);
  if (denied) return denied;
  const bucket = bucketFromEnv();
  const event = await eventFor(id);
  const uploadId = uploadIdFrom(event?.providerBroadcastId || "");
  if (bucket && uploadId) await bucket.resumeMultipartUpload(`broadcasts/${id}`, uploadId).abort().catch(() => undefined);
  if (bucket) await bucket.delete(`broadcasts/${id}`);
  return Response.json({ ok: true });
}
