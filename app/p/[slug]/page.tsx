import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { PublicLanding } from "../../PublicLanding";
import { getPublishedProjectBySlug } from "../../server/public-project";

const loadPublishedProject = cache(getPublishedProjectBySlug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await loadPublishedProject(slug);
  if (!project) {
    return {
      title: "Landing page chưa sẵn sàng",
      robots: { index: false, follow: false },
    };
  }
  const settings = project.publishSettings;
  const pagePath = `/p/${encodeURIComponent(project.slug)}`;
  const ogImage = settings.ogAssetId
    ? `/api/assets/${encodeURIComponent(settings.ogAssetId)}`
    : null;
  const favicon = settings.faviconAssetId
    ? `/api/assets/${encodeURIComponent(settings.faviconAssetId)}`
    : null;
  return {
    title: settings.seoTitle,
    description: settings.seoDescription,
    alternates: { canonical: settings.canonicalUrl || pagePath },
    robots: settings.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: settings.canonicalUrl || pagePath,
      title: settings.seoTitle,
      description: settings.seoDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: settings.seoTitle,
      description: settings.seoDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    icons: favicon ? { icon: favicon } : undefined,
  };
}

export default async function PublishedLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadPublishedProject(slug);
  if (!project) notFound();
  if (project.redirected) {
    permanentRedirect(`/p/${encodeURIComponent(project.slug)}`);
  }
  return (
    <PublicLanding
      slug={project.slug}
      initialLanding={project.landing}
      dashboardType={project.dashboardType}
    />
  );
}
