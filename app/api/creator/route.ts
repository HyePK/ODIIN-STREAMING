import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { accounts, events } from "../../../db/schema";

function emailFrom(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
}

async function creatorFor(request: Request) {
  const email = emailFrom(request);
  if (!email) return null;
  const db = getDb();
  const ownerEmail = "ots.ent.g@gmail.com";
  if (email === ownerEmail) {
    await db.insert(accounts).values({
      email,
      displayName: "ODIIN Owner",
      subscriptionStatus: "active",
      subscriptionPlan: "owner creator",
      creatorAccess: true,
      channelName: "ODIIN Owner Channel",
      channelSlug: "odiin-owner",
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({ target: accounts.email, set: {
      subscriptionStatus: "active",
      subscriptionPlan: "owner creator",
      creatorAccess: true,
      channelStatus: "active",
      updatedAt: new Date().toISOString(),
    } });
  }
  let [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (account && email === ownerEmail && !account.channelSlug) {
    await db.update(accounts).set({ channelName: account.channelName || "ODIIN Owner Channel", channelSlug: "odiin-owner", channelStatus: "active", updatedAt: new Date().toISOString() }).where(eq(accounts.email, email));
    [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  }
  if (!account || account.subscriptionStatus !== "active" || !account.creatorAccess || account.channelStatus === "restricted") return null;
  return account;
}

export async function GET(request: Request) {
  try {
    const account = await creatorFor(request);
    if (!account) return Response.json({ error: "An active ODIIN creator subscription is required." }, { status: 403 });
    const db = getDb();
    const rows = await db.select().from(events).where(eq(events.creatorEmail, account.email)).orderBy(desc(events.startsAt));
    return Response.json({
      creator: { displayName: account.displayName, subscriptionPlan: account.subscriptionPlan, whipEndpoint: account.whipEndpoint, whipToken: account.whipToken, playbackUrl: account.playbackUrl, channelName: account.channelName || account.displayName, channelSlug: account.channelSlug },
      events: rows,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Creator Studio is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const account = await creatorFor(request);
    if (!account) return Response.json({ error: "An active ODIIN creator subscription is required." }, { status: 403 });
    const body = await request.json() as { action?: string; eventId?: string; title?: string; description?: string; category?: string; startsAt?: string; gateType?: string; gateCode?: string; gateMessage?: string };
    const db = getDb();
    if (body.action === "create") {
      const title = body.title?.trim();
      if (!title) return Response.json({ error: "Broadcast title is required." }, { status: 400 });
      const id = crypto.randomUUID();
      const row = {
        id, title, description: body.description?.trim() ?? "", startsAt: body.startsAt && !Number.isNaN(Date.parse(body.startsAt)) ? new Date(body.startsAt).toISOString() : new Date().toISOString(), durationMinutes: 60,
        status: "scheduled", category: body.category?.trim() || "Creator Live", homeRow: "show-series", streamUrl: account.playbackUrl,
        providerBroadcastId: "", posterUrl: "", gateType: ["none", "code", "register"].includes(body.gateType ?? "") ? body.gateType! : "none",
        gateCode: body.gateCode?.trim() ?? "", gateMessage: body.gateMessage?.trim() || "This broadcast is reserved for registered viewers.",
        creatorEmail: account.email, updatedAt: new Date().toISOString(),
      };
      await db.insert(events).values(row);
      return Response.json({ event: row });
    }
    if (!body.eventId) return Response.json({ error: "Broadcast is required." }, { status: 400 });
    const [event] = await db.select().from(events).where(and(eq(events.id, body.eventId), eq(events.creatorEmail, account.email))).limit(1);
    if (!event) return Response.json({ error: "Broadcast was not found." }, { status: 404 });
    if (body.action === "live") {
      if (!account.playbackUrl) return Response.json({ error: "Your playback destination has not been configured." }, { status: 409 });
      await db.update(events).set({ status: "live", streamUrl: account.playbackUrl, startsAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(events.id, event.id));
    } else if (body.action === "stop") {
      await db.update(events).set({ status: "published", updatedAt: new Date().toISOString() }).where(eq(events.id, event.id));
    } else if (body.action === "delete") {
      await db.delete(events).where(eq(events.id, event.id));
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update the broadcast." }, { status: 500 });
  }
}
