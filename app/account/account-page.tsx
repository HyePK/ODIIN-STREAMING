"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, ChevronLeft, Heart, LoaderCircle, UserRound } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function AccountPage({ email, defaultName }: { email: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [exists, setExists] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [creatorActive, setCreatorActive] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/account").then((r) => r.json()).then((data) => { if (data.account) { setExists(true); setName(data.account.displayName); setCreatorActive(data.account.subscriptionStatus === "active" && data.account.creatorAccess); } setSavedCount(data.savedEventIds?.length ?? 0); }).finally(() => setBusy(false)); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", displayName: name }) }); const data = await response.json() as { error?: string }; setBusy(false); if (!response.ok) return setMessage(data.error || "Unable to save account."); setExists(true); setMessage("Your ODIIN account is ready."); }
  return <main className="account-page"><a className="account-back" href="/"><ChevronLeft /> Back to ODIIN STREAMING</a><section className="account-card"><span className="account-icon">{exists ? <Check /> : <UserRound />}</span><p className="eyebrow">ODIIN account</p><h1>{exists ? "Your viewer profile" : "Create your account"}</h1><p>Save broadcasts to your library and return to them from any signed-in device.</p><form onSubmit={submit}><label>Display name<Input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Email<Input value={email} disabled /></label><Button className="primary-action" disabled={busy}>{busy && <LoaderCircle className="spin" />}{exists ? "Update account" : "Create ODIIN account"}</Button></form>{message && <div className="account-message">{message}</div>}{exists && <div className="account-stats"><Heart fill="currentColor" /><b>{savedCount}</b><span>Saved videos</span></div>}{creatorActive && <a className="creator-studio-link" href="/studio">Open ODIIN Creator Studio</a>}</section></main>;
}
