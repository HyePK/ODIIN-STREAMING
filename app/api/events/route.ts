import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { events, settings } from "../../../db/schema";
import { hasAdminAccess } from "../../admin-auth";

type EventInput = {
  id?: string; title?: string; description?: string; startsAt?: string;
  durationMinutes?: number; status?: string; category?: string;
  homeRow?: string;
  streamUrl?: string; providerBroadcastId?: string; posterUrl?: string;
  gateType?: string; gateCode?: string; gateMessage?: string;
};

function message(error: unknown) {
  const value = error instanceof Error ? error.message : "Unexpected data error";
  return value.includes("no such table")
    ? "The event database is being prepared. Please retry after deployment finishes."
    : value;
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const [eventRows, settingRows] = await Promise.all([
      db.select().from(events).orderBy(desc(events.startsAt)),
      db.select().from(settings),
    ]);
    const adminAuthorized = await hasAdminAccess(request.headers);
    const adminView = new URL(request.url).searchParams.get("admin") === "1" && adminAuthorized;
    const visibleRows = adminView ? eventRows : eventRows.filter((row) => row.status !== "draft");
    const canSeePrivatePlayback = adminAuthorized;
    const safeEvents = visibleRows.map((row) => canSeePrivatePlayback ? row : {
      ...row,
      gateCode: "",
      streamUrl: row.gateType === "none" ? row.streamUrl : "",
      providerBroadcastId: row.gateType === "none" ? row.providerBroadcastId : "",
    });
    return Response.json({
      events: safeEvents,
      settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
    });
  } catch (error) {
    return Response.json({ events: [], settings: {}, warning: message(error) });
  }
}

export async function POST(request: Request) {
  if (!await hasAdminAccess(request.headers)) {
    return Response.json({ error: "Owner authorization is required." }, { status: 401 });
  }
  try {
    const payload = (await request.json()) as {
      action?: string; event?: EventInput; id?: string; values?: Record<string, string>;
    };
    const db = getDb();
    if (payload.action === "delete") {
      if (!payload.id) return Response.json({ error: "Event id is required." }, { status: 400 });
      const [existing] = await db.select().from(events).where(eq(events.id, payload.id)).limit(1);
      if (existing?.streamUrl === `/api/media/${payload.id}`) {
        const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
        if (bucket) await bucket.delete(`broadcasts/${payload.id}`);
      }
      await db.delete(events).where(eq(events.id, payload.id));
      await db.insert(settings).values({ key: "catalogInitialized", value: "1", updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: settings.key, set: { value: "1", updatedAt: new Date().toISOString() } });
      return Response.json({ ok: true });
    }
    if (payload.action === "settings") {
      const entries = Object.entries(payload.values ?? {});
      if (entries.length) {
        await db.batch(entries.map(([key, value]) =>
          db.insert(settings).values({ key, value, updatedAt: new Date().toISOString() })
            .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date().toISOString() } })
        ));
      }
      return Response.json({ ok: true });
    }
    const event = payload.event ?? {};
    if (!event.title?.trim() || !event.startsAt) {
      return Response.json({ error: "Title and start time are required." }, { status: 400 });
    }
    const id = event.id || crypto.randomUUID();
    const row = {
      id,
      title: event.title.trim(),
      description: event.description?.trim() ?? "",
      startsAt: event.startsAt,
      durationMinutes: Math.max(1, Number(event.durationMinutes) || 60),
      status: event.status ?? "scheduled",
      category: event.category?.trim() || "Live Event",
      homeRow: ["indie-podcasts", "indie-movies", "show-series", "artist-music-review"].includes(event.homeRow ?? "") ? event.homeRow! : "show-series",
      streamUrl: event.streamUrl?.trim() ?? "",
      providerBroadcastId: event.providerBroadcastId?.trim() ?? "",
      posterUrl: event.posterUrl?.trim() ?? "",
      gateType: ["none", "code", "register"].includes(event.gateType ?? "") ? event.gateType! : "none",
      gateCode: event.gateCode?.trim() ?? "",
      gateMessage: event.gateMessage?.trim() || "This broadcast is reserved for registered viewers.",
      updatedAt: new Date().toISOString(),
    };
    await db.insert(events).values(row).onConflictDoUpdate({ target: events.id, set: row });
    await db.insert(settings).values({ key: "catalogInitialized", value: "1", updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: settings.key, set: { value: "1", updatedAt: new Date().toISOString() } });
    return Response.json({ event: row });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
