"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CalendarDays, Camera, ChevronLeft, Clapperboard, Copy, LoaderCircle, LockKeyhole, Mic, Plus, RadioTower, Share2, Square, Trash2, UploadCloud, Video } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../components/ui/alert-dialog";

type CreatorEvent = { id: string; title: string; description: string; status: string; startsAt: string };
type Creator = { displayName: string; subscriptionPlan: string; whipEndpoint: string; whipToken: string; playbackUrl: string; channelName: string; channelSlug: string };
type ContentMode = "recorded" | "live";

const initialStart = () => new Date(Date.now() + 3600000).toISOString().slice(0, 16);

function CreatorDelete({ title, onDelete }: { title: string; onDelete: () => void }) {
  return <AlertDialog><AlertDialogTrigger asChild><button type="button" className="creator-delete" aria-label={`Delete ${title}`}><Trash2 /></button></AlertDialogTrigger><AlertDialogContent className="delete-dialog"><AlertDialogHeader><AlertDialogTitle>Delete this broadcast?</AlertDialogTitle><AlertDialogDescription>“{title}” will be removed from Creator Studio and the ODIIN viewer site.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep broadcast</AlertDialogCancel><AlertDialogAction className="confirm-delete" onClick={onDelete}>Delete broadcast</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

export function CreatorStudio({ email }: { email: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const resourceRef = useRef("");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [events, setEvents] = useState<CreatorEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<ContentMode>("recorded");
  const [liveTiming, setLiveTiming] = useState<"now" | "schedule">("now");
  const [form, setForm] = useState(() => ({ title: "", description: "", category: "Creator Live", startsAt: initialStart(), gateType: "none", gateCode: "", gateMessage: "" }));
  const [recording, setRecording] = useState<File | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [viewerLink, setViewerLink] = useState("");

  async function load() {
    setBusy(true);
    const response = await fetch("/api/creator", { cache: "no-store" });
    const data = await response.json() as { creator?: Creator; events?: CreatorEvent[]; error?: string };
    if (!response.ok) setMessage(data.error || "Creator access is unavailable.");
    else { setCreator(data.creator ?? null); setEvents(data.events ?? []); setSelectedId((current) => current || data.events?.[0]?.id || ""); }
    setBusy(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(initialLoad); mediaRef.current?.getTracks().forEach((track) => track.stop()); peerRef.current?.close(); };
  }, []);

  async function enableCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      mediaRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true); setMessage("Camera and microphone are ready.");
      return stream;
    } catch { setMessage("Camera or microphone permission was not granted."); return null; }
  }

  async function waitForIce(peer: RTCPeerConnection) {
    if (peer.iceGatheringState === "complete") return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 4000);
      const done = () => { if (peer.iceGatheringState === "complete") { window.clearTimeout(timer); peer.removeEventListener("icegatheringstatechange", done); resolve(); } };
      peer.addEventListener("icegatheringstatechange", done);
    });
  }

  async function goLive(eventId = selectedId) {
    if (!creator?.whipEndpoint) return setMessage("Your administrator must connect a live publishing endpoint before this device can go live.");
    if (!eventId) return setMessage("Create or select a live broadcast first.");
    if (!mediaRef.current && !await enableCamera()) return;
    setBusy(true); setMessage("Connecting your live feed…");
    try {
      const peer = new RTCPeerConnection(); peerRef.current = peer;
      mediaRef.current!.getTracks().forEach((track) => peer.addTrack(track, mediaRef.current!));
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await waitForIce(peer);
      const response = await fetch(creator.whipEndpoint, { method: "POST", headers: { "Content-Type": "application/sdp", ...(creator.whipToken ? { Authorization: `Bearer ${creator.whipToken}` } : {}) }, body: peer.localDescription?.sdp });
      if (!response.ok) throw new Error(`Live connection failed (${response.status}).`);
      const location = response.headers.get("location"); resourceRef.current = location ? new URL(location, creator.whipEndpoint).toString() : "";
      const status = await fetch("/api/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "live", eventId }) });
      const result = await status.json() as { error?: string };
      if (!status.ok) throw new Error(result.error || "Unable to publish the broadcast.");
      setSelectedId(eventId); setViewerLink(`${window.location.origin}/watch/${encodeURIComponent(eventId)}`); setLive(true); setMessage("You are live on ODIIN STREAMING. Share the connected viewer link below.");
    } catch (error) { peerRef.current?.close(); setMessage(error instanceof Error ? error.message : "Unable to go live."); }
    finally { setBusy(false); }
  }

  async function createBroadcast(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (mode === "recorded" && !recording) return setMessage("Choose a recorded video before publishing.");
    if (mode === "live" && liveTiming === "now" && !mediaRef.current && !await enableCamera()) return;
    setBusy(true);
    try {
      const startsAt = mode === "live" && liveTiming === "now" ? new Date().toISOString() : form.startsAt;
      const response = await fetch("/api/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...form, category: mode === "recorded" ? "Creator Video" : "Creator Live", startsAt }) });
      const data = await response.json() as { event?: CreatorEvent; error?: string };
      if (!response.ok || !data.event) throw new Error(data.error || "Unable to create broadcast.");
      const link = `${window.location.origin}/watch/${encodeURIComponent(data.event.id)}`;
      setSelectedId(data.event.id); setViewerLink(link);
      if (mode === "recorded" && recording) {
        const upload = await fetch(`/api/media/${encodeURIComponent(data.event.id)}`, { method: "PUT", headers: { "Content-Type": recording.type || "video/mp4", "x-file-name": recording.name }, body: recording });
        const result = await upload.json() as { error?: string };
        if (!upload.ok) throw new Error(result.error || "Video upload failed.");
        setRecording(null); setMessage("Recorded event published. Its ODIIN viewer link is ready to share.");
      } else if (liveTiming === "now") {
        setBusy(false); await goLive(data.event.id);
      } else {
        setMessage("Live event scheduled. Its ODIIN viewer link is ready now; select Go live when the event begins.");
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create broadcast."); }
    finally { setBusy(false); }
  }

  async function stopLive() {
    setBusy(true);
    try {
      if (resourceRef.current) await fetch(resourceRef.current, { method: "DELETE", headers: creator?.whipToken ? { Authorization: `Bearer ${creator.whipToken}` } : {} }).catch(() => undefined);
      peerRef.current?.close();
      await fetch("/api/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", eventId: selectedId }) });
      setLive(false); setMessage("Live broadcast ended and remains available from its ODIIN link."); await load();
    } finally { setBusy(false); }
  }

  async function remove(id: string) { await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined); await fetch("/api/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", eventId: id }) }); if (selectedId === id) { setSelectedId(""); setViewerLink(""); } await load(); }
  async function share(id: string, title: string) { const url = `${window.location.origin}/watch/${encodeURIComponent(id)}`; if (navigator.share) await navigator.share({ title, text: `Watch ${title} on ODIIN STREAMING`, url }).catch(() => undefined); else { await navigator.clipboard.writeText(url); setMessage("ODIIN viewer link copied."); } }
  async function copyViewerLink() { if (!viewerLink) return; await navigator.clipboard.writeText(viewerLink); setMessage("ODIIN viewer link copied."); }

  if (!busy && !creator) return <main className="studio-denied"><Link href="/"><ChevronLeft /> ODIIN STREAMING</Link><LockKeyhole /><h1>Creator subscription required</h1><p>{message}</p><Link className="studio-account-link" href="/account">View your ODIIN account</Link></main>;

  return <main className="studio-page">
    <header><Link href="/"><ChevronLeft /> Viewer site</Link><span><img src="/odiin-mark.svg" alt="" /><b>ODIIN</b> CREATOR STUDIO</span><em>{creator?.subscriptionPlan || "Creator"}</em></header>
    <section className="studio-mode-picker"><p className="eyebrow">Choose how to distribute</p><div><button type="button" aria-pressed={mode === "recorded"} className={mode === "recorded" ? "active" : ""} onClick={() => setMode("recorded")}><Clapperboard /><span><b>1 — Pre-recorded event</b><small>Upload a completed video and publish it to ODIIN.</small></span></button><button type="button" aria-pressed={mode === "live"} className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}><RadioTower /><span><b>2 — Live from device</b><small>Use this phone, tablet, or computer as your live camera.</small></span></button></div></section>
    <section className="studio-grid">
      <div className="broadcast-stage"><div className="studio-video"><video ref={videoRef} autoPlay muted playsInline />{mode === "recorded" ? <div className="camera-empty"><Clapperboard /><h2>Pre-recorded event</h2><p>Your selected video will publish to a unique ODIIN viewer link.</p></div> : !cameraReady && <div className="camera-empty"><Camera /><h2>Connect this device</h2><p>Allow camera and microphone access on your phone, tablet, or computer.</p><Button onClick={enableCamera}><Camera /> Allow camera and microphone</Button></div>}{live && <span className="on-air"><i /> Live</span>}</div>{mode === "live" && <div className="studio-controls"><Button variant="outline" onClick={enableCamera}><Camera /> Camera</Button><Button variant="outline" onClick={enableCamera}><Mic /> Microphone</Button>{live ? <Button className="end-broadcast" onClick={stopLive} disabled={busy}><Square fill="currentColor" /> End live</Button> : <Button className="go-broadcast" onClick={() => goLive()} disabled={busy || !selectedId}>{busy ? <LoaderCircle className="spin" /> : <RadioTower />} Go live now</Button>}</div>}{viewerLink && <div className="viewer-link-card"><span><b>Connected ODIIN viewer link</b><small>{viewerLink}</small></span><Button variant="outline" onClick={copyViewerLink}><Copy /> Copy link</Button></div>}<div className="studio-message">{message || `Signed in as ${email}`}</div></div>
      <aside className="studio-sidebar"><div className="studio-title-row"><div><p className="eyebrow">{mode === "recorded" ? "Upload content" : "Device broadcast"}</p><h2>{mode === "recorded" ? "Publish an event" : "Create a live event"}</h2></div>{creator?.channelSlug && <Link href={`/channel/${creator.channelSlug}`}>View channel</Link>}</div><form onSubmit={createBroadcast}><label>Title<Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Description<Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{mode === "live" && <><label>Start option<select value={liveTiming} onChange={(e) => setLiveTiming(e.target.value as "now" | "schedule")}><option value="now">Go live right away</option><option value="schedule">Schedule for later</option></select></label>{liveTiming === "schedule" && <label><CalendarDays /> Scheduled start<Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></label>}</>}<label>Viewer gate<select value={form.gateType} onChange={(e) => setForm({ ...form, gateType: e.target.value })}><option value="none">Open viewing</option><option value="code">Access code</option><option value="register">Name and email</option></select></label>{form.gateType === "code" && <label>Access code<Input value={form.gateCode} onChange={(e) => setForm({ ...form, gateCode: e.target.value })} required /></label>}{mode === "recorded" && <label className="creator-upload"><span><UploadCloud /><b>{recording ? recording.name : "Choose recorded video"}</b><small>{recording ? `${(recording.size / 1024 / 1024).toFixed(1)} MB selected` : "MP4, MOV, WebM, or another browser-ready format"}</small></span><Input type="file" accept="video/*" onChange={(e) => setRecording(e.target.files?.[0] ?? null)} /></label>}<Button className="primary-action" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : mode === "recorded" ? <UploadCloud /> : liveTiming === "now" ? <RadioTower /> : <Plus />} {mode === "recorded" ? "Publish recorded event" : liveTiming === "now" ? "Create and go live" : "Schedule live event"}</Button></form><div className="creator-events"><p className="eyebrow">Your broadcasts</p>{events.map((event) => <div key={event.id} className={`creator-event ${selectedId === event.id ? "selected" : ""}`} onClick={() => { setSelectedId(event.id); setViewerLink(`${window.location.origin}/watch/${encodeURIComponent(event.id)}`); }}><Video /><span><b>{event.title}</b><small>{event.status}</small></span><button type="button" className="creator-share" aria-label={`Share ${event.title}`} onClick={(click) => { click.stopPropagation(); share(event.id, event.title); }}><Share2 /></button><CreatorDelete title={event.title} onDelete={() => remove(event.id)} /></div>)}</div></aside>
    </section>
  </main>;
}
