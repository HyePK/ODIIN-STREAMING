"use client";

import { useEffect, useState } from "react";

type Channel = { displayName: string; channelName: string; channelDescription: string };
type ChannelEvent = { id: string; title: string; category: string; status: string; startsAt: string; posterUrl: string };

export function ChannelPageClient({ slug }: { slug: string }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [events, setEvents] = useState<ChannelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/channel/${encodeURIComponent(slug)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { channel?: Channel; events?: ChannelEvent[] };
      setChannel(data.channel ?? null); setEvents(data.events ?? []);
    }).finally(() => setLoading(false));
  }, [slug]);
  if (loading) return <main className="channel-unavailable"><a href="/">ODIIN STREAMING</a><h1>Loading channel</h1></main>;
  if (!channel) return <main className="channel-unavailable"><a href="/">ODIIN STREAMING</a><h1>Channel unavailable</h1><p>This creator channel is not currently available.</p></main>;
  return <main className="creator-channel-page">
    <header><a href="/"><img src="/odiin-mark.svg" alt="" /><b>ODIIN</b> STREAMING</a><span>Creator channel</span></header>
    <section className="channel-hero"><p>ODIIN CREATOR</p><h1>{channel.channelName || channel.displayName}</h1><span>{channel.channelDescription || `Live broadcasts and replays from ${channel.displayName}.`}</span></section>
    <section className="channel-catalog"><div><h2>Broadcasts</h2><small>{events.length} available</small></div><div className="channel-grid">{events.map((event) => <a href={`/watch/${encodeURIComponent(event.id)}`} key={event.id}><span className="channel-art">{event.posterUrl ? <img src={event.posterUrl} alt="" /> : <img src="/odiin-mark.svg" alt="" />}{event.status === "live" && <em>LIVE</em>}</span><small>{event.category}</small><b>{event.title}</b><time>{new Date(event.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></a>)}</div>{!events.length && <p className="channel-empty">This creator has not published a broadcast yet.</p>}</section>
  </main>;
}
