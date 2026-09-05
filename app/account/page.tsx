import { requireChatGPTUser } from "../chatgpt-auth";
import { AccountPage } from "./account-page";

export const dynamic = "force-dynamic";

export default async function Account() {
  const user = await requireChatGPTUser("/account");
  return <AccountPage email={user.email} defaultName={user.displayName} />;
}
