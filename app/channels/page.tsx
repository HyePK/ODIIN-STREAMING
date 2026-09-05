import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { accounts, events } from "../../db/schema";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  let channels: Array<{ slug: string; name: string; description: string; plan: string; broadcasts: number; live: number }> = [];
  try {
    const db = getDb();
    const [creatorRows, eventRows] = await Promise.all([
      db.select().from(accounts).where(and(eq(accounts.subscriptionStatus, "active"), eq(accounts.creatorAccess, true), eq(accounts.channelStatus, "active"), ne(accounts.channelSlug, ""))),
      db.select({ creatorEmail: events.creatorEmail, status: events.status }).from(events),
    ]);
    channels = creatorRows.map((creator) => {
      const creatorEvents = eventRows.filter((event) => event.creatorEmail === creator.email);
      return {
        slug: creator.channelSlug,
        name: creator.channelName || creator.displayName,
        description: creator.channelDescription || `Live broadcasts and replays from ${creator.displayName}.`,
        plan: creator.subscriptionPlan,
        broadcasts: creatorEvents.length,
        live: creatorEvents.filter((event) => event.status === "live").length,
      };
    }).sort((left, right) => right.live - left.live || left.name.localeCompare(right.name));
  } catch {
    channels = [];
  }

  return <main className="channels-page">
    <header><Link href="/"><img src="/odiin-mark.svg" alt="" /><b>ODIIN</b> STREAMING</Link><span>Creator network</span></header>
    <section className="channels-directory">
      <div className="channels-heading"><p>ODIIN CHANNELS</p><h1>Paid creator channels</h1><span>Watch live programming and replays directly from ODIIN creators.</span></div>
      {channels.length ? <div className="channels-grid">{channels.map((channel) => <Link href={`/channel/${encodeURIComponent(channel.slug)}`} key={channel.slug}>
        <span className="channel-directory-art"><img src="/odiin-mark.svg" alt="" />{channel.live > 0 && <em>LIVE NOW</em>}</span>
        <small>{channel.plan}</small><h2>{channel.name}</h2><p>{channel.description}</p><div className="channel-directory-meta"><span>{channel.broadcasts} {channel.broadcasts === 1 ? "broadcast" : "broadcasts"}</span><b>Open channel →</b></div>
      </Link>)}</div> : <div className="channels-empty"><img src="/odiin-mark.svg" alt="" /><h2>Creator channels are coming soon</h2><p>Active paid creator channels will appear here automatically.</p></div>}
    </section>
  </main>;
}
