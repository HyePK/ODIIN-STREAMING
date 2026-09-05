import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, viewerAccess } from "../../../db/schema";

type GatePayload = { eventId?: string; code?: string; name?: string; email?: string };

function playback(event: typeof events.$inferSelect) {
  return {
    streamUrl: event.streamUrl,
    providerBroadcastId: event.providerBroadcastId,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GatePayload;
    if (!body.eventId) return Response.json({ error: "Broadcast is required." }, { status: 400 });
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.id, body.eventId)).limit(1);
    if (!event) return Response.json({ error: "Broadcast was not found." }, { status: 404 });

    if (event.gateType === "code") {
      if (!event.gateCode || body.code?.trim() !== event.gateCode) {
        return Response.json({ error: "That access code is not valid." }, { status: 403 });
      }
      return Response.json({ ok: true, playback: playback(event) });
    }

    if (event.gateType === "register") {
      const name = body.name?.trim() ?? "";
      const email = body.email?.trim().toLowerCase() ?? "";
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "Enter your name and a valid email address." }, { status: 400 });
      }
      await db.insert(viewerAccess).values({ eventId: event.id, name, email });
      return Response.json({ ok: true, playback: playback(event) });
    }

    return Response.json({ ok: true, playback: playback(event) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to open this broadcast." }, { status: 500 });
  }
}
