import { OdiinApp } from "../odiin-app";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAdminAccess } from "../admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!await hasAdminAccess(await headers())) redirect("/admin-access");
  return <OdiinApp initialView="admin" />;
}
