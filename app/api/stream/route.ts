import { env } from "cloudflare:workers";

function normalize(raw: Record<string, unknown>, embedBase: string) {
  const id = String(raw.id ?? "");
  return {
    id,
    title: String(raw.name ?? raw.title ?? "Untitled broadcast"),
    description: String(raw.description ?? ""),
    startsAt: String(raw.starts_at ?? raw.start_at ?? new Date().toISOString()),
    status: String(raw.timeframe ?? raw.status ?? "scheduled").toLowerCase(),
    providerBroadcastId: id && embedBase ? `${embedBase.replace(/\/$/, "")}/${encodeURIComponent(id)}` : "",
  };
}

export async function GET(request: Request) {
  const channel = new URL(request.url).searchParams.get("channel")?.trim();
  if (!channel || !/^[a-zA-Z0-9_-]+$/.test(channel)) {
    return Response.json({ error: "A valid channel id is required." }, { status: 400 });
  }
  try {
    const runtime = env as unknown as Record<string, string | undefined>;
    const streamApi = runtime.ODIIN_STREAM_API_URL?.replace(/\/$/, "");
    const embedBase = runtime.ODIIN_STREAM_EMBED_URL ?? "";
    if (!streamApi) return Response.json({ error: "A stream schedule provider has not been configured." }, { status: 409 });
    const response = await fetch(`${streamApi}/channels/${encodeURIComponent(channel)}/broadcasts`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Stream service returned ${response.status}.`);
    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { broadcasts?: unknown[] }).broadcasts)
        ? (payload as { broadcasts: unknown[] }).broadcasts : [];
    return Response.json({ broadcasts: rows.map((row) => normalize(row as Record<string, unknown>, embedBase)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to sync broadcasts." }, { status: 502 });
  }
}
