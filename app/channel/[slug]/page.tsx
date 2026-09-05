import { ChannelPageClient } from "./channel-page-client";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ChannelPageClient slug={slug} />;
}
