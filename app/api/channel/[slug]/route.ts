import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accounts, events } from "../../../../db/schema";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [channel] = await db.select().from(accounts).where(eq(accounts.channelSlug, slug.toLowerCase())).limit(1);
    if (!channel || channel.channelStatus !== "active" || !channel.creatorAccess || channel.subscriptionStatus !== "active") return Response.json({ error: "Channel unavailable." }, { status: 404 });
    const rows = (await db.select().from(events).where(eq(events.creatorEmail, channel.email)).orderBy(desc(events.startsAt))).filter((event) => event.status !== "draft");
    return Response.json({
      channel: { displayName: channel.displayName, channelName: channel.channelName, channelDescription: channel.channelDescription },
      events: rows.map((event) => ({ id: event.id, title: event.title, category: event.category, status: event.status, startsAt: event.startsAt, posterUrl: event.posterUrl })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Channel unavailable." }, { status: 500 });
  }
}
