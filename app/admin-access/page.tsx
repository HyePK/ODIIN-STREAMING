import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAdminAccess } from "../admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await hasAdminAccess(await headers())) redirect("/admin");
  const { error } = await searchParams;

  return <main className="admin-access-page">
    <Link className="admin-access-back" href="/"><img src="/odiin-mark.svg" alt="" /><b>ODIIN</b> STREAMING</Link>
    <form action="/api/admin-auth" method="post" className="admin-access-card">
      <p className="eyebrow">Protected access</p>
      <h1>Admin Control Center</h1>
      <p>Enter the ODIIN administrator code to continue.</p>
      <label>Admin code<input name="code" type="password" inputMode="numeric" autoComplete="current-password" required /></label>
      {error && <span role="alert">That admin code is incorrect.</span>}
      <button type="submit">Open Admin Dashboard</button>
    </form>
  </main>;
}
