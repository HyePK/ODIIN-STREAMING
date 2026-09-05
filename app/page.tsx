import { OdiinApp } from "./odiin-app";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <OdiinApp accountEmail={user?.email ?? null} />;
}
