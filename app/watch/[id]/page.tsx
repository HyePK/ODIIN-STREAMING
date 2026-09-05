import { getChatGPTUser } from "../../chatgpt-auth";
import { OdiinApp } from "../../odiin-app";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getChatGPTUser()]);
  return <OdiinApp initialEventId={id} accountEmail={user?.email ?? null} />;
}
