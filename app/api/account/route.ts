import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { accounts, events, savedVideos } from "../../../db/schema";
import { hasAdminAccess } from "../../admin-auth";

function viewerEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    if (new URL(request.url).searchParams.get("admin") === "1") {
      if (!await hasAdminAccess(request.headers)) return Response.json({ error: "Owner authorization is required." }, { status: 401 });
      const [accountRows, savedRows] = await Promise.all([db.select().from(accounts), db.select().from(savedVideos)]);
      return Response.json({ accounts: accountRows.map((account) => ({ ...account, savedCount: savedRows.filter((row) => row.accountEmail === account.email).length })) });
    }
    const email = viewerEmail(request);
    if (!email) return Response.json({ account: null, savedEventIds: [] });
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    const saved = account ? await db.select().from(savedVideos).where(eq(savedVideos.accountEmail, email)) : [];
    if (!account) return Response.json({ account: null, savedEventIds: [] });
    const { whipToken: _hiddenToken, whipEndpoint: _hiddenEndpoint, playbackUrl: _hiddenPlayback, ...publicAccount } = account;
    return Response.json({ account: publicAccount, savedEventIds: saved.map((row) => row.eventId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Account information is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; displayName?: string; eventId?: string; email?: string; subscriptionStatus?: string; subscriptionPlan?: string; creatorAccess?: boolean; whipEndpoint?: string; whipToken?: string; playbackUrl?: string; channelName?: string; channelSlug?: string; channelDescription?: string; channelStatus?: string };
    const db = getDb();
    if (body.action === "manageCreator") {
      if (!await hasAdminAccess(request.headers)) return Response.json({ error: "Owner authorization is required." }, { status: 401 });
      const targetEmail = body.email?.trim().toLowerCase();
      if (!targetEmail) return Response.json({ error: "Subscriber email is required." }, { status: 400 });
      const channelSlug = body.channelSlug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ?? "";
      if (channelSlug) {
        const [existingChannel] = await db.select().from(accounts).where(eq(accounts.channelSlug, channelSlug)).limit(1);
        if (existingChannel && existingChannel.email !== targetEmail) return Response.json({ error: "That channel address is already in use." }, { status: 409 });
      }
      await db.update(accounts).set({
        subscriptionStatus: body.subscriptionStatus === "active" ? "active" : "inactive",
        subscriptionPlan: body.subscriptionPlan?.trim() || "creator",
        creatorAccess: Boolean(body.creatorAccess),
        whipEndpoint: body.whipEndpoint?.trim() ?? "",
        whipToken: body.whipToken?.trim() ?? "",
        playbackUrl: body.playbackUrl?.trim() ?? "",
        channelName: body.channelName?.trim() ?? "",
        channelSlug,
        channelDescription: body.channelDescription?.trim() ?? "",
        channelStatus: body.channelStatus === "restricted" ? "restricted" : "active",
        updatedAt: new Date().toISOString(),
      }).where(eq(accounts.email, targetEmail));
      return Response.json({ ok: true });
    }
    if (body.action === "deleteCreatorChannel" || body.action === "deleteSubscriber") {
      if (!await hasAdminAccess(request.headers)) return Response.json({ error: "Owner authorization is required." }, { status: 401 });
      const targetEmail = body.email?.trim().toLowerCase();
      if (!targetEmail) return Response.json({ error: "Subscriber email is required." }, { status: 400 });
      const runtime = env as unknown as Record<string, string | undefined>;
      const ownerEmail = (runtime.ODIIN_OWNER_EMAIL ?? "ots.ent.g@gmail.com").toLowerCase();
      if (targetEmail === ownerEmail) return Response.json({ error: "The owner test account cannot be deleted." }, { status: 409 });
      const creatorEvents = await db.select().from(events).where(eq(events.creatorEmail, targetEmail));
      const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
      const objectKeys = creatorEvents.filter((event) => event.streamUrl === `/api/media/${event.id}`).map((event) => `broadcasts/${event.id}`);
      if (bucket && objectKeys.length) await bucket.delete(objectKeys);
      await db.delete(events).where(eq(events.creatorEmail, targetEmail));
      if (body.action === "deleteSubscriber") {
        await db.delete(accounts).where(eq(accounts.email, targetEmail));
      } else {
        await db.update(accounts).set({ creatorAccess: false, subscriptionStatus: "inactive", channelStatus: "restricted", whipEndpoint: "", whipToken: "", playbackUrl: "", updatedAt: new Date().toISOString() }).where(eq(accounts.email, targetEmail));
      }
      return Response.json({ ok: true });
    }
    const email = viewerEmail(request);
    if (!email) return Response.json({ error: "Sign in to manage your ODIIN account." }, { status: 401 });
    if (body.action === "register") {
      const displayName = body.displayName?.trim() || email.split("@")[0];
      await db.insert(accounts).values({ email, displayName, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: accounts.email, set: { displayName, updatedAt: new Date().toISOString() } });
      return Response.json({ ok: true });
    }
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (!account) return Response.json({ error: "Create your ODIIN account before saving videos." }, { status: 409 });
    if (!body.eventId) return Response.json({ error: "Choose a video." }, { status: 400 });
    if (body.action === "unsave") {
      await db.delete(savedVideos).where(and(eq(savedVideos.accountEmail, email), eq(savedVideos.eventId, body.eventId)));
    } else {
      await db.insert(savedVideos).values({ accountEmail: email, eventId: body.eventId }).onConflictDoNothing();
    }
    const saved = await db.select().from(savedVideos).where(eq(savedVideos.accountEmail, email));
    return Response.json({ ok: true, savedEventIds: saved.map((row) => row.eventId), savedCount: saved.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update the account." }, { status: 500 });
  }
}
