import { adminSessionCookie, isValidAdminCode } from "../../admin-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  if (!isValidAdminCode(code)) return Response.redirect(new URL("/admin-access?error=1", request.url), 303);

  const response = Response.redirect(new URL("/admin", request.url), 303);
  response.headers.set("Set-Cookie", await adminSessionCookie());
  return response;
}
