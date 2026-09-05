"use client";

import Link from "next/link";
import Hls from "hls.js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Airplay, CalendarDays, ChevronRight, CircleUserRound, Clock3, Film,
  Gauge, Library, ListVideo, LoaderCircle, Menu, Play, Plus, Radio,
  Search, Settings2, ShieldCheck, Smartphone, Sparkles, Trash2, X,
  LockKeyhole, Mail, UserRound, UploadCloud, RadioTower, Square,
  Heart, Share2, RotateCcw, Pause, FastForward, Volume2, VolumeX, Maximize,
  Tv2, KeyRound,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";

type View = "watch" | "schedule" | "library" | "admin";
type EventItem = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  category: string;
  homeRow: string;
  streamUrl: string;
  providerBroadcastId: string;
  posterUrl: string;
  gateType: string;
  gateCode: string;
  gateMessage: string;
  creatorEmail?: string;
};

type CreatorAccount = {
  email: string; displayName: string; createdAt: string; savedCount: number;
  subscriptionStatus: string; subscriptionPlan: string; creatorAccess: boolean;
  whipEndpoint: string; whipToken: string; playbackUrl: string;
  channelName: string; channelSlug: string; channelDescription: string; channelStatus: string;
};

const nav = [
  { id: "watch" as const, label: "Home", icon: Play },
  { id: "schedule" as const, label: "Schedule", icon: CalendarDays },
  { id: "library" as const, label: "Library", icon: Library },
  { id: "admin" as const, label: "Control", icon: Gauge },
];

const EMPTY_EVENT: EventItem = {
  id: "offline", title: "ODIIN STREAMING", description: "New programming will appear here when it is published.",
  startsAt: new Date().toISOString(), durationMinutes: 0, status: "scheduled", category: "Network", homeRow: "show-series",
  streamUrl: "", providerBroadcastId: "", posterUrl: "", gateType: "none", gateCode: "", gateMessage: "",
};

function formatDate(value: string, compact = false) {
  return new Intl.DateTimeFormat("en-US", compact
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
  ).format(new Date(value));
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="ODIIN STREAMING home">
      <span className="brand-mark"><span /></span>
      <span className="brand-copy"><b>ODIIN</b><small>STREAMING</small></span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <Badge className={`status status-${normalized}`}>
      {normalized === "live" && <span className="pulse-dot" />}
      {normalized === "published" ? "Replay" : normalized}
    </Badge>
  );
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function requestOdiinFullscreen() {
  const shell = document.querySelector<HTMLElement>("[data-odiin-player]");
  const video = shell?.querySelector("video") as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
  try {
    if (shell?.requestFullscreen) return shell.requestFullscreen().catch(() => undefined);
    if (video?.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return; }
    if (document.documentElement.requestFullscreen) return document.documentElement.requestFullscreen().catch(() => undefined);
  } catch { return; }
}

function OdiinVideo({ src, poster, playRequest }: { src: string; poster?: string; playRequest: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  function showControls(autoHide = playing) {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (autoHide) hideTimer.current = setTimeout(() => setControlsVisible(false), 5000);
  }
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const isHls = /\.m3u8(?:$|[?#])/i.test(src);
    const nativeManagedHls = Boolean(video.canPlayType("application/vnd.apple.mpegurl")) && "ManagedMediaSource" in window;
    if (isHls && !nativeManagedHls && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);
  useEffect(() => {
    const video = ref.current;
    if (!video || playRequest <= 0) return;
    const start = () => {
      video.play().then(() => showControls(true)).catch(() => {
        video.muted = true; setMuted(true);
        video.play().then(() => showControls(true)).catch(() => undefined);
      });
    };
    if (video.readyState >= 2) start(); else video.addEventListener("canplay", start, { once: true });
    return () => video.removeEventListener("canplay", start);
  }, [src, playRequest]);

  function toggle() { const video = ref.current; if (!video) return; showControls(); if (video.paused) video.play().catch(() => undefined); else video.pause(); }
  function rewind() { const video = ref.current; if (!video) return; video.currentTime = Math.max(0, video.currentTime - 10); showControls(); }
  function forward() { const video = ref.current; if (!video) return; video.currentTime = Math.min(Number.isFinite(video.duration) ? video.duration : video.currentTime + 10, video.currentTime + 10); showControls(); }
  function seek(value: number) { const video = ref.current; if (!video || !Number.isFinite(video.duration)) return; video.currentTime = value; setCurrentTime(value); showControls(); }
  function changeVolume(value: number) { const video = ref.current; if (!video) return; video.volume = value; video.muted = value === 0; setVolume(value); setMuted(value === 0); showControls(); }
  function toggleMute() { const video = ref.current; if (!video) return; video.muted = !video.muted; setMuted(video.muted); showControls(); }
  function fullscreen() { requestOdiinFullscreen(); showControls(); }

  return <div className="odiin-video" data-odiin-player onMouseMove={showControls} onTouchStart={showControls} onClick={showControls}>
    <video ref={ref} className="player-media" playsInline poster={poster} preload="metadata" onPlay={() => { setPlaying(true); showControls(true); }} onPause={() => { setPlaying(false); setControlsVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); }} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }} />
    <div className={`video-controls ${controlsVisible ? "is-visible" : "is-hidden"}`} onClick={(e) => e.stopPropagation()}>
      <div className="video-progress-row"><span>{formatPlaybackTime(currentTime)}</span><input aria-label="Seek video" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} onChange={(e) => seek(Number(e.target.value))} /><span>{formatPlaybackTime(duration)}</span></div>
      <div className="video-control-row">
        <button className="main-video-control" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
        <button onClick={rewind} aria-label="Rewind 10 seconds"><RotateCcw /><span>10</span></button>
        <button onClick={forward} aria-label="Forward 10 seconds"><FastForward /><span>10</span></button>
        <div className="video-volume"><button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>{muted || volume === 0 ? <VolumeX /> : <Volume2 />}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(e) => changeVolume(Number(e.target.value))} /></div>
        <button className="fullscreen-control" onClick={fullscreen} aria-label="Full screen"><Maximize /></button>
      </div>
    </div>
  </div>;
}

function Player({ event, playRequest }: { event: EventItem; playRequest: number }) {
  const [gateForm, setGateForm] = useState({ code: "", name: "", email: "" });
  const [gateError, setGateError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState<{ streamUrl: string; providerBroadcastId: string } | null>(null);
  useEffect(() => {
    const resetGate = window.setTimeout(() => { setUnlocked(null); setGateError(""); setGateForm({ code: "", name: "", email: "" }); }, 0);
    return () => window.clearTimeout(resetGate);
  }, [event.id]);

  const gated = event.gateType && event.gateType !== "none" && !unlocked;
  const streamUrl = unlocked?.streamUrl ?? event.streamUrl;
  const providerBroadcastId = unlocked?.providerBroadcastId ?? event.providerBroadcastId;
  const embedUrl = /^https:\/\//i.test(providerBroadcastId) ? providerBroadcastId : "";

  async function openGate(submitEvent: FormEvent) {
    submitEvent.preventDefault(); setUnlocking(true); setGateError("");
    try {
      const response = await fetch("/api/gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, ...gateForm }) });
      const data = await response.json() as { error?: string; playback?: { streamUrl: string; providerBroadcastId: string } };
      if (!response.ok || !data.playback) throw new Error(data.error || "Unable to open this broadcast.");
      setUnlocked(data.playback);
    } catch (error) { setGateError(error instanceof Error ? error.message : "Unable to open this broadcast."); }
    finally { setUnlocking(false); }
  }

  return (
    <div className="player-shell">
      {gated ? (
        <form className="viewer-gate" onSubmit={openGate}>
          <span className="gate-icon">{event.gateType === "code" ? <LockKeyhole /> : <Mail />}</span>
          <p className="eyebrow">Viewer gate</p>
          <h2>{event.gateType === "code" ? "Enter your access code" : "Register to watch"}</h2>
          <p>{event.gateMessage || "This broadcast is reserved for registered viewers."}</p>
          {event.gateType === "code" ? (
            <Input aria-label="Access code" type="password" value={gateForm.code} onChange={(e) => setGateForm({ ...gateForm, code: e.target.value })} placeholder="Access code" required />
          ) : (
            <div className="gate-fields"><label><UserRound /><Input aria-label="Name" value={gateForm.name} onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })} placeholder="Your name" required /></label><label><Mail /><Input aria-label="Email" type="email" value={gateForm.email} onChange={(e) => setGateForm({ ...gateForm, email: e.target.value })} placeholder="Email address" required /></label></div>
          )}
          {gateError && <span className="gate-error">{gateError}</span>}
          <Button className="primary-action" disabled={unlocking}>{unlocking ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} Continue to broadcast</Button>
        </form>
      ) : streamUrl ? (
        <OdiinVideo src={streamUrl} poster={event.posterUrl || undefined} playRequest={playRequest} />
      ) : embedUrl ? (
        <iframe className="player-media" src={embedUrl} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={event.title} />
      ) : (
        <div className="player-standby" style={event.posterUrl ? { backgroundImage: `linear-gradient(180deg,rgba(3,7,17,.1),rgba(3,7,17,.84)),url(${event.posterUrl})` } : undefined}>
          <div className="signal-rings"><span /><span /><span /></div>
          <button className="play-orb" aria-label="Broadcast not yet live"><Play fill="currentColor" /></button>
          <p>{event.status === "live" ? "Connecting to live signal" : "Broadcast begins soon"}</p>
          <small>Playback activates when a stream is connected</small>
        </div>
      )}
      <div className="player-topline">
        <StatusBadge status={event.status} />
        <span>ODIIN STREAMING</span>
      </div>
    </div>
  );
}

function EmptyPoster({ index = 0 }: { index?: number }) {
  return (
    <div className={`poster-art art-${index % 4}`}>
      <span className="poster-ring" />
      <img src="/odiin-mark.svg" alt="" />
    </div>
  );
}

function EventCard({ event, index, onSelect }: { event: EventItem; index: number; onSelect: (event: EventItem) => void }) {
  return (
    <Card className="event-card" onClick={() => onSelect(event)}>
      <div className="event-poster">
        {event.posterUrl ? <img src={event.posterUrl} alt="" /> : <EmptyPoster index={index} />}
        <span className="card-play"><Play size={17} fill="currentColor" /></span>
        <StatusBadge status={event.status} />
      </div>
      <div className="event-card-body">
        <p className="eyebrow">{event.category}</p>
        <h3>{event.title}</h3>
        <p className="event-time"><CalendarDays size={14} /> {formatDate(event.startsAt, true)}</p>
      </div>
    </Card>
  );
}

const HOME_ROWS = [
  { key: "live-now", title: "LIVE NOW", eyebrow: "Streaming now" },
  { key: "indie-podcasts", title: "INDIE PODCASTS", eyebrow: "Independent voices" },
  { key: "indie-movies", title: "INDIE MOVIES", eyebrow: "Original cinema" },
  { key: "show-series", title: "SHOW SERIES", eyebrow: "Episodes and originals" },
  { key: "artist-music-review", title: "ARTIST MUSIC REVIEW", eyebrow: "Music discovery" },
] as const;

function HomeRail({ title, eyebrow, events, onSelect }: { title: string; eyebrow: string; events: EventItem[]; onSelect: (event: EventItem) => void }) {
  return <section className="content-section home-row"><div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{events.length} {events.length === 1 ? "title" : "titles"}</span></div>{events.length ? <div className="home-rail">{events.map((event, index) => <EventCard key={event.id} event={event} index={index} onSelect={onSelect} />)}</div> : <div className="home-row-empty"><RadioTower /><span>{title === "LIVE NOW" ? "No channel is live right now." : "New content will appear here when it is placed in this row."}</span></div>}</section>;
}

function WatchView({ events, selected, onPlay, playRequest, setView, saved, onSave, onShare }: {
  events: EventItem[]; selected: EventItem; onPlay: (item: EventItem) => void; playRequest: number; setView: (view: View) => void;
  saved: boolean; onSave: () => void; onShare: () => void;
}) {
  if (!events.length) {
    return <section className="public-empty"><div className="empty-signal"><span /><RadioTower /></div><p className="eyebrow">ODIIN STREAMING</p><h1>No broadcast is available right now</h1><p>Live events and newly published videos will appear here automatically.</p></section>;
  }
  return (
    <>
      <section className="hero-grid">
        <Player event={selected} playRequest={playRequest} />
        <div className="now-card">
          <p className="eyebrow"><Radio size={15} /> Featured broadcast</p>
          <StatusBadge status={selected.status} />
          <h1>{selected.title}</h1>
          <p className="lead">{selected.description}</p>
          <div className="time-row"><CalendarDays size={17} /><span>{formatDate(selected.startsAt)}</span></div>
          <div className="time-row"><Clock3 size={17} /><span>{selected.durationMinutes} minutes</span></div>
          <div className="hero-actions">
            <Button className="primary-action" onClick={() => onPlay(selected)}><Play size={17} fill="currentColor" /> Play now</Button>
            <Button variant="outline" className={`secondary-action ${saved ? "saved-action" : ""}`} onClick={onSave}><Heart size={17} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}</Button>
            <Button variant="outline" className="secondary-action share-action" onClick={onShare}><Share2 size={17} /> Share</Button>
            <Button variant="outline" className="secondary-action" onClick={() => setView("schedule")}>Full schedule</Button>
          </div>
        </div>
      </section>

      {HOME_ROWS.map((row) => <HomeRail key={row.key} title={row.title} eyebrow={row.eyebrow} events={events.filter((event) => row.key === "live-now" ? event.status === "live" : event.status !== "live" && event.homeRow === row.key)} onSelect={onPlay} />)}
    </>
  );
}

function ScheduleView({ events, onSelect }: { events: EventItem[]; onSelect: (item: EventItem) => void }) {
  const rows = events.filter((item) => item.status !== "published").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return (
    <section className="page-section">
      <div className="page-intro"><p className="eyebrow">Never miss a moment</p><h1>Broadcast schedule</h1><p>Live premieres, conversations, performances, and special events—organized in one place.</p></div>
      <div className="timeline">
        {rows.map((event, index) => (
          <article key={event.id} className="timeline-row">
            <div className="timeline-date"><small>{new Date(event.startsAt).toLocaleString("en-US", { weekday: "short" })}</small><b>{new Date(event.startsAt).getDate()}</b><span>{new Date(event.startsAt).toLocaleString("en-US", { month: "short" })}</span></div>
            <div className="timeline-art">{event.posterUrl ? <img src={event.posterUrl} alt="" /> : <EmptyPoster index={index} />}</div>
            <div className="timeline-copy"><StatusBadge status={event.status} /><p>{event.category}</p><h2>{event.title}</h2><span>{formatDate(event.startsAt)} · {event.durationMinutes} min</span><button onClick={() => onSelect(event)}>View broadcast <ChevronRight size={16} /></button></div>
          </article>
        ))}
      </div>
      {!rows.length && <div className="empty-state"><CalendarDays /><h2>No broadcasts scheduled</h2><p>New live events will appear here after they are scheduled.</p></div>}
    </section>
  );
}

function LibraryView({ events, onSelect, savedIds, accountEmail }: { events: EventItem[]; onSelect: (item: EventItem) => void; savedIds: string[]; accountEmail: string | null }) {
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(Boolean(accountEmail));
  const rows = events.filter((item) => item.status === "published" && (!savedOnly || savedIds.includes(item.id)) && `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="page-section">
      <div className="library-head"><div className="page-intro"><p className="eyebrow">On demand</p><h1>Replay library</h1><p>Return to past broadcasts and ODIIN originals.</p></div><label className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos" /></label></div>
      <div className="library-filters"><button className={!savedOnly ? "active" : ""} onClick={() => setSavedOnly(false)}>All videos</button><button className={savedOnly ? "active" : ""} onClick={() => accountEmail ? setSavedOnly(true) : window.location.href = "/account"}><Heart size={15} fill={savedOnly ? "currentColor" : "none"} /> Saved</button></div>
      <div className="event-grid library-grid">{rows.map((event, index) => <EventCard key={event.id} event={event} index={index} onSelect={onSelect} />)}</div>
      {!rows.length && <div className="empty-state"><Film /><h2>{savedOnly ? "Your saved library is empty" : "No replays found"}</h2><p>{savedOnly ? "Save a video or movie and it will appear here." : "Try a different search or publish a recording from Control Center."}</p></div>}
    </section>
  );
}

const blankEvent = (): EventItem => ({
  id: "", title: "", description: "", startsAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  durationMinutes: 60, status: "scheduled", category: "Live Event", homeRow: "show-series", streamUrl: "", providerBroadcastId: "", posterUrl: "",
  gateType: "none", gateCode: "", gateMessage: "This broadcast is reserved for registered viewers.", creatorEmail: "",
});

function DeleteBroadcastButton({ event, onDelete }: { event: EventItem; onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><button className="delete-button" aria-label={`Delete ${event.title}`}><Trash2 size={17} /><span>Delete</span></button></AlertDialogTrigger>
      <AlertDialogContent className="delete-dialog">
        <AlertDialogHeader><AlertDialogTitle>Delete this broadcast?</AlertDialogTitle><AlertDialogDescription>This permanently removes “{event.title}” from the schedule and replay library. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Keep broadcast</AlertDialogCancel><AlertDialogAction className="confirm-delete" onClick={onDelete}>Delete broadcast</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminView({ events, reload }: { events: EventItem[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [channelId, setChannelId] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<CreatorAccount[]>([]);
  const [managedAccount, setManagedAccount] = useState<CreatorAccount | null>(null);
  async function loadAccounts() { const response = await fetch("/api/account?admin=1"); const data = await response.json() as { accounts?: CreatorAccount[] }; setAccounts(data.accounts ?? []); }
  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadAccounts().catch(() => undefined); }, 0);
    const refresh = window.setInterval(() => loadAccounts().catch(() => undefined), 15000);
    const onFocus = () => loadAccounts().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(refresh); window.removeEventListener("focus", onFocus); };
  }, []);

  async function saveCreatorAccount(account: CreatorAccount) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "manageCreator", ...account }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update creator access.");
      await loadAccounts(); setManagedAccount(null); setNotice("Creator access updated.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update creator access."); }
    finally { setBusy(false); }
  }

  async function removeCreatorAccount(account: CreatorAccount, action: "deleteCreatorChannel" | "deleteSubscriber") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action, email: account.email }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to remove subscriber content.");
      await Promise.all([loadAccounts(), reload()]); setManagedAccount(null);
      setNotice(action === "deleteSubscriber" ? "Subscriber and creator content deleted." : "Creator channel removed and access revoked.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to remove subscriber content."); }
    finally { setBusy(false); }
  }

  const authHeaders = () => ({ "Content-Type": "application/json", ...(adminKey ? { "x-odiin-admin-key": adminKey } : {}) });

  async function request(body: unknown) {
    const response = await fetch("/api/events", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    const data = await response.json() as { error?: string; event?: EventItem };
    if (!response.ok) throw new Error(data.error || "Unable to save changes.");
    return data;
  }

  async function send(body: unknown, success = "Changes saved.") {
    setBusy(true); setNotice("");
    try {
      await request(body);
      await reload(); setEditing(null); setNotice(success);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save changes."); }
    finally { setBusy(false); }
  }

  async function saveBroadcast(event: EventItem, video: File | null) {
    setBusy(true); setNotice("");
    try {
      const saved = await request({ event });
      const id = saved.event?.id;
      if (video && id) {
        const upload = await fetch(`/api/media/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": video.type || "video/mp4", "x-file-name": video.name, ...(adminKey ? { "x-odiin-admin-key": adminKey } : {}) },
          body: video,
        });
        const result = await upload.json() as { error?: string };
        if (!upload.ok) throw new Error(result.error || "Video upload failed.");
      }
      await reload(); setEditing(null); setNotice(video ? "Broadcast saved and video published." : "Broadcast saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save broadcast."); }
    finally { setBusy(false); }
  }

  async function toggleLive(event: EventItem) {
    const goingLive = event.status !== "live";
    if (goingLive && !event.streamUrl && !event.providerBroadcastId) {
      setNotice("Connect a live stream or upload a video before going live."); return;
    }
    await send({ event: { ...event, status: goingLive ? "live" : "published" } }, goingLive ? `${event.title} is now live.` : `${event.title} is now available as a replay.`);
  }

  async function syncChannel() {
    if (!channelId.trim()) return setNotice("Enter a channel id first.");
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/stream?channel=${encodeURIComponent(channelId.trim())}`);
      const data = await response.json() as { broadcasts?: EventItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to sync.");
      for (const item of data.broadcasts ?? []) await send({ event: { ...item, durationMinutes: 60, category: "Live Event", streamUrl: "", posterUrl: "" } });
      await send({ action: "settings", values: { channelId: channelId.trim() } });
      setNotice(`${data.broadcasts?.length ?? 0} broadcasts synchronized.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to sync."); setBusy(false); }
  }

  return (
    <section className="page-section admin-page">
      <div className="page-intro"><p className="eyebrow"><ShieldCheck size={15} /> Owner workspace</p><h1>Control Center</h1><p>Schedule programming, connect streams, and publish replays without leaving ODIIN.</p></div>
      <div className="metrics-grid">
        <Card className="metric-card"><Radio /><span><b>{events.filter((e) => e.status === "live").length}</b><small>Live now</small></span></Card>
        <Card className="metric-card"><CalendarDays /><span><b>{events.filter((e) => e.status === "scheduled").length}</b><small>Scheduled</small></span></Card>
        <Card className="metric-card"><Film /><span><b>{events.filter((e) => e.status === "published").length}</b><small>Published</small></span></Card>
        <Card className="metric-card"><Heart /><span><b>{accounts.reduce((sum, account) => sum + account.savedCount, 0)}</b><small>Viewer saves</small></span></Card>
        <Card className="metric-card"><Airplay /><span><b>Ready</b><small>Stream system</small></span></Card>
      </div>
      <div className="admin-layout">
        <div className="admin-panel">
          <div className="panel-title"><div><p className="eyebrow">Programming</p><h2>Broadcasts</h2></div><Button className="primary-action" onClick={() => setEditing(blankEvent())}><Plus size={17} /> Add broadcast</Button></div>
          <div className="event-table">
            {events.map((event) => <div className="event-row" key={event.id}><span className="row-icon"><ListVideo size={18} /></span><span className="row-main"><b>{event.title}</b><small>{formatDate(event.startsAt, true)} · {event.gateType === "none" ? "Open viewing" : event.gateType === "code" ? "Access code" : "Registration gate"}{event.creatorEmail ? ` · ${event.creatorEmail}` : ""}</small></span><StatusBadge status={event.status} /><button className={`live-toggle ${event.status === "live" ? "end-live" : ""}`} onClick={() => toggleLive(event)}>{event.status === "live" ? <Square size={14} fill="currentColor" /> : <RadioTower size={16} />}{event.status === "live" ? "End live" : "Go live"}</button><button className="edit-button" onClick={() => setEditing({ ...event, startsAt: event.startsAt.slice(0, 16) })}>Edit</button><DeleteBroadcastButton event={event} onDelete={() => send({ action: "delete", id: event.id }, "Broadcast deleted.")} /></div>)}
            {!events.length && <div className="empty-broadcasts"><RadioTower /><h3>No broadcasts yet</h3><p>Add a live event or upload a recorded video to publish it.</p><Button className="primary-action" onClick={() => setEditing(blankEvent())}><Plus size={17} /> Add broadcast</Button></div>}
          </div>
        </div>
        <aside className="settings-panel">
          <p className="eyebrow"><Settings2 size={15} /> Stream source</p><h2>Connect broadcasts</h2><p>Enter your public channel identifier to import live and scheduled programming.</p>
          <label>Channel ID<Input value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="Enter channel id" /></label>
          <Button variant="outline" onClick={syncChannel} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />} Sync schedule</Button>
          <div className="divider" />
          <label>Admin key <Input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Only needed outside owner workspace" /></label>
          <p className="hint">Owner workspace access is recognized automatically. A private key can secure edits when the public app is enabled.</p>
          <div className="app-ready"><Smartphone /><div><b>App ready</b><small>This build can be installed on phones and packaged for app stores.</small></div></div>
        </aside>
      </div>
      <section className="accounts-panel"><div className="panel-title"><div><p className="eyebrow"><UserRound size={15} /> Audience</p><h2>ODIIN accounts</h2></div><Badge className="account-count">{accounts.length} accounts</Badge></div>{accounts.length ? <div className="accounts-table">{accounts.map((account) => <div className="account-row" key={account.email}><span className="account-avatar">{account.displayName.slice(0, 1).toUpperCase()}</span><span><b>{account.displayName}</b><small>{account.email}</small></span><em>{account.creatorAccess && account.subscriptionStatus === "active" ? "Creator active" : `${account.savedCount} saved`}</em><time>{new Date(account.createdAt).toLocaleDateString()}</time><button onClick={() => setManagedAccount(account)}>Manage</button></div>)}</div> : <div className="accounts-empty">Viewer accounts will appear here after people register.</div>}</section>
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")}><X size={16} /></button></div>}
      {editing && <EventEditor item={editing} busy={busy} onClose={() => setEditing(null)} onSave={saveBroadcast} />}
      {managedAccount && <CreatorAccountEditor account={managedAccount} busy={busy} onClose={() => setManagedAccount(null)} onSave={saveCreatorAccount} onDeleteChannel={() => removeCreatorAccount(managedAccount, "deleteCreatorChannel")} onDeleteSubscriber={() => removeCreatorAccount(managedAccount, "deleteSubscriber")} />}
    </section>
  );
}

function CreatorAccountEditor({ account, busy, onClose, onSave, onDeleteChannel, onDeleteSubscriber }: { account: CreatorAccount; busy: boolean; onClose: () => void; onSave: (account: CreatorAccount) => void; onDeleteChannel: () => void; onDeleteSubscriber: () => void }) {
  const [value, setValue] = useState(account);
  const ownerAccount = value.email.toLowerCase() === "ots.ent.g@gmail.com";
  return <div className="modal-backdrop" role="presentation"><form className="event-editor creator-editor" onSubmit={(event) => { event.preventDefault(); onSave(value); }}><div className="editor-head"><div><p className="eyebrow">Subscriber controls</p><h2>{value.displayName}</h2><span>{value.email}</span></div><button type="button" onClick={onClose}><X /></button></div><div className="creator-toggle"><span><b>Paid creator access</b><small>Allows this subscriber to open Creator Studio and distribute live content.</small></span><Switch checked={value.creatorAccess && value.subscriptionStatus === "active"} onCheckedChange={(checked) => setValue({ ...value, creatorAccess: checked, subscriptionStatus: checked ? "active" : "inactive", subscriptionPlan: checked ? (value.subscriptionPlan === "viewer" ? "creator" : value.subscriptionPlan) : value.subscriptionPlan })} /></div><div className="creator-toggle"><span><b>Channel page</b><small>Restrict this creator&apos;s public page and prevent Studio access.</small></span><Switch checked={value.channelStatus !== "restricted"} onCheckedChange={(checked) => setValue({ ...value, channelStatus: checked ? "active" : "restricted" })} /></div><label>Subscription plan<Input value={value.subscriptionPlan} onChange={(e) => setValue({ ...value, subscriptionPlan: e.target.value })} placeholder="Creator" /></label><div className="form-grid"><label>Channel name<Input value={value.channelName} onChange={(e) => setValue({ ...value, channelName: e.target.value })} placeholder={value.displayName} /></label><label>Channel address<Input value={value.channelSlug} onChange={(e) => setValue({ ...value, channelSlug: e.target.value })} placeholder="creator-channel" /></label></div><label>Channel description<Textarea value={value.channelDescription} onChange={(e) => setValue({ ...value, channelDescription: e.target.value })} placeholder="Describe this creator channel" /></label><label>Live publishing endpoint<Input value={value.whipEndpoint} onChange={(e) => setValue({ ...value, whipEndpoint: e.target.value })} placeholder="https://…/whip" /></label><label>Publishing token<Input type="password" value={value.whipToken} onChange={(e) => setValue({ ...value, whipToken: e.target.value })} placeholder="Secure publishing token" /></label><label>Viewer playback URL<Input value={value.playbackUrl} onChange={(e) => setValue({ ...value, playbackUrl: e.target.value })} placeholder="https://…/live.m3u8" /></label>{value.channelSlug && <Link className="creator-page-link" href={`/channel/${value.channelSlug}`} target="_blank" rel="noreferrer">Open creator page</Link>}<div className="creator-danger-zone"><span><b>Channel actions</b><small>These actions remove creator content. The owner test account is protected.</small></span>{!ownerAccount && <div><AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline">Delete channel</Button></AlertDialogTrigger><AlertDialogContent className="delete-dialog"><AlertDialogHeader><AlertDialogTitle>Delete this creator channel?</AlertDialogTitle><AlertDialogDescription>All broadcasts owned by this creator will be deleted and paid access will be revoked.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="confirm-delete" onClick={onDeleteChannel}>Delete channel</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline">Delete subscriber</Button></AlertDialogTrigger><AlertDialogContent className="delete-dialog"><AlertDialogHeader><AlertDialogTitle>Delete this subscriber?</AlertDialogTitle><AlertDialogDescription>The account, saved library, creator page, and creator-owned broadcasts will be permanently deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="confirm-delete" onClick={onDeleteSubscriber}>Delete subscriber</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>}</div><div className="editor-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />} Save subscriber controls</Button></div></form></div>;
}

function EventEditor({ item, busy, onClose, onSave }: { item: EventItem; busy: boolean; onClose: () => void; onSave: (event: EventItem, video: File | null) => void }) {
  const [value, setValue] = useState(item);
  const [video, setVideo] = useState<File | null>(null);
  function submit(event: FormEvent) { event.preventDefault(); onSave(value, video); }
  return (
    <div className="modal-backdrop" role="presentation"><form className="event-editor" onSubmit={submit}>
      <div className="editor-head"><div><p className="eyebrow">Broadcast details</p><h2>{value.id ? "Edit broadcast" : "Add broadcast"}</h2></div><button type="button" onClick={onClose}><X /></button></div>
      <label>Broadcast title<Input required value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} /></label>
      <label>Description<Textarea value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} /></label>
      <div className="form-grid"><label>Start time<Input required type="datetime-local" value={value.startsAt.slice(0, 16)} onChange={(e) => setValue({ ...value, startsAt: e.target.value })} /></label><label>Duration<Input type="number" min="1" value={value.durationMinutes} onChange={(e) => setValue({ ...value, durationMinutes: Number(e.target.value) })} /></label></div>
      <div className="form-grid"><label>Category<Input value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })} /></label><label>Status<select value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value })}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="published">Published replay</option><option value="draft">Draft</option></select></label></div>
      <label>Direct playback URL<Input value={value.streamUrl} onChange={(e) => setValue({ ...value, streamUrl: e.target.value })} placeholder="https://…/stream.m3u8 or .mp4" /></label>
      <label>Hosted player URL<Input value={value.providerBroadcastId} onChange={(e) => setValue({ ...value, providerBroadcastId: e.target.value })} placeholder="Optional secure https embed URL" /></label>
      <label>Poster image URL<Input value={value.posterUrl} onChange={(e) => setValue({ ...value, posterUrl: e.target.value })} /></label>
      <label className="video-upload"><span><UploadCloud /><b>{video ? video.name : value.streamUrl.startsWith("/api/media/") ? "Replace uploaded video" : "Upload recorded video"}</b><small>{video ? `${(video.size / 1024 / 1024).toFixed(1)} MB selected` : "Choose an MP4, MOV, WebM, or other browser-ready video"}</small></span><Input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} /></label>
      <label>Home page row<select value={value.homeRow} onChange={(e) => setValue({ ...value, homeRow: e.target.value })}><option value="indie-podcasts">INDIE PODCASTS</option><option value="indie-movies">INDIE MOVIES</option><option value="show-series">SHOW SERIES</option><option value="artist-music-review">ARTIST MUSIC REVIEW</option></select></label>
      <div className="gate-settings">
        <div><p className="eyebrow"><LockKeyhole size={14} /> Viewer gate</p><h3>Control access to this broadcast</h3></div>
        <label>Gate type<select value={value.gateType} onChange={(e) => setValue({ ...value, gateType: e.target.value })}><option value="none">No gate — open viewing</option><option value="code">Require an access code</option><option value="register">Require name and email</option></select></label>
        {value.gateType === "code" && <label>Access code<Input required value={value.gateCode} onChange={(e) => setValue({ ...value, gateCode: e.target.value })} placeholder="Create a code for this broadcast" /></label>}
        {value.gateType !== "none" && <label>Gate message<Textarea value={value.gateMessage} onChange={(e) => setValue({ ...value, gateMessage: e.target.value })} placeholder="Message viewers see before entering" /></label>}
      </div>
      <div className="editor-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />} {video ? "Upload and publish" : "Save broadcast"}</Button></div>
    </form></div>
  );
}

export function OdiinApp({ initialView = "watch", initialEventId, accountEmail = null }: { initialView?: View; initialEventId?: string; accountEmail?: string | null }) {
  const [view, setView] = useState<View>(initialView);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selected, setSelected] = useState<EventItem>(EMPTY_EVENT);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [playRequest, setPlayRequest] = useState(0);

  async function loadEvents() {
    try {
      const response = await fetch(initialView === "admin" ? "/api/events?admin=1" : "/api/events", { cache: "no-store" });
      const data = await response.json() as { events?: EventItem[]; settings?: Record<string, string> };
      if (data.events?.length) { setEvents(data.events); setSelected((current) => data.events?.find((event) => event.id === (initialEventId || current.id)) ?? data.events![0]); }
      else { setEvents([]); setSelected(EMPTY_EVENT); }
    } catch { setEvents([]); setSelected(EMPTY_EVENT); }
    finally { setLoading(false); }
  }
  useEffect(() => { const initialLoad = window.setTimeout(() => { void loadEvents(); }, 0); return () => window.clearTimeout(initialLoad); }, []);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => undefined); }, []);
  useEffect(() => { if (accountEmail) fetch("/api/account").then((response) => response.json()).then((data) => setSavedIds(data.savedEventIds ?? [])).catch(() => undefined); }, [accountEmail]);

  const adminMode = initialView === "admin";
  const visibleNav = adminMode ? [{ id: "admin" as const, label: "Dashboard", icon: Gauge }] : nav.filter((item) => item.id !== "admin");
  const title = useMemo(() => visibleNav.find((item) => item.id === view)?.label ?? "Watch", [view, adminMode]);
  function openEvent(event: EventItem) {
    requestOdiinFullscreen();
    setSelected(event);
    setPlayRequest((value) => value + 1);
    setView("watch");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function toggleSaved() {
    if (!accountEmail) { window.location.href = "/account"; return; }
    const saved = savedIds.includes(selected.id);
    const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: saved ? "unsave" : "save", eventId: selected.id }) });
    const data = await response.json() as { savedEventIds?: string[] };
    if (response.ok) setSavedIds(data.savedEventIds ?? (saved ? savedIds.filter((id) => id !== selected.id) : [...savedIds, selected.id]));
    else if (response.status === 409) window.location.href = "/account";
  }
  async function shareSelected() {
    const url = `${window.location.origin}/watch/${encodeURIComponent(selected.id)}`;
    if (navigator.share) await navigator.share({ title: selected.title, text: `Watch ${selected.title} on ODIIN STREAMING`, url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url);
  }

  return (
    <div className="app-shell">
      <header className="site-header"><div className="header-inner"><Brand /><nav className={menuOpen ? "nav-open" : ""} aria-label="Primary">{visibleNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMenuOpen(false); }}><item.icon size={17} />{item.label}</button>)}{!adminMode && <><Link href="/channels"><Tv2 size={17} />Channels</Link><Link href="/admin-access"><KeyRound size={17} />Admin</Link></>}{adminMode && <Link className="view-site-link" href="/">View public site</Link>}</nav><div className="header-actions"><span className="live-chip"><span /> Network ready</span><Link className="profile-button" aria-label="ODIIN account" href="/account"><CircleUserRound /></Link><button className="menu-button" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div></div></header>
      <main className="main-content" aria-label={title}>
        {loading && <div className="loading-line" />}
        {view === "watch" && <WatchView events={events} selected={selected} onPlay={openEvent} playRequest={playRequest} setView={setView} saved={savedIds.includes(selected.id)} onSave={toggleSaved} onShare={shareSelected} />}
        {view === "schedule" && <ScheduleView events={events} onSelect={openEvent} />}
        {view === "library" && <LibraryView events={events} onSelect={openEvent} savedIds={savedIds} accountEmail={accountEmail} />}
        {view === "admin" && <AdminView events={events} reload={loadEvents} />}
      </main>
      <footer><Brand /><p>Original live programming and replays, wherever you watch.</p><span>© {new Date().getFullYear()} ODIIN STREAMING</span></footer>
      {!adminMode && <nav className="mobile-nav public-mobile-nav" aria-label="Mobile navigation">{visibleNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={20} /><small>{item.label}</small></button>)}<a href="/channels"><Tv2 size={20} /><small>Channels</small></a><a href="/admin-access"><KeyRound size={20} /><small>Admin</small></a></nav>}
    </div>
  );
}
