import { requireChatGPTUser } from "../chatgpt-auth";
import { CreatorStudio } from "./studio-client";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await requireChatGPTUser("/studio");
  return <CreatorStudio email={user.email} />;
}
