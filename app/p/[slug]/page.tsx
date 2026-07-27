import { PublicLanding } from "../../PublicLanding";

export default async function PublishedLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicLanding slug={slug} />;
}
