import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { accounts, events } from "../../../../db/schema";
import { hasAdminAccess } from "../../../admin-auth";

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return Response.json({ error: "Invalid broadcast id." }, { status: 400 });
  if (!await canWrite(request, id)) return Response.json({ error: "An active creator subscription is required." }, { status: 401 });
  if (!request.body) return Response.json({ error: "Choose a video file to upload." }, { status: 400 });
  const contentType = request.headers.get("content-type") ?? "video/mp4";
  if (!contentType.startsWith("video/")) return Response.json({ error: "The selected file must be a video." }, { status: 415 });

  try {
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (!bucket) throw new Error("Video storage is unavailable.");
    const key = `broadcasts/${id}`;
    await bucket.put(key, request.body, {
      httpMetadata: { contentType, cacheControl: "private, max-age=0" },
      customMetadata: { originalName: request.headers.get("x-file-name")?.slice(0, 240) ?? "recording" },
    });
    const db = getDb();
    await db.update(events).set({ streamUrl: `/api/media/${id}`, providerBroadcastId: "", status: "published", updatedAt: new Date().toISOString() }).where(eq(events.id, id));
    return Response.json({ ok: true, streamUrl: `/api/media/${id}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Video upload failed." }, { status: 500 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return new Response("Not found", { status: 404 });
  const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!bucket) return new Response("Video storage unavailable", { status: 503 });
  const object = await bucket.get(`broadcasts/${id}`);
  if (!object) return new Response("Video not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=0");
  return new Response(object.body, { headers });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return Response.json({ error: "Invalid broadcast id." }, { status: 400 });
  if (!await canWrite(request, id)) return Response.json({ error: "An active creator subscription is required." }, { status: 401 });
  const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (bucket) await bucket.delete(`broadcasts/${id}`);
  return Response.json({ ok: true });
}
