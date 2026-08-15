"use client";

import { LandingCanvas } from "./components/LandingCanvas";
import { normalizeLandingData, type LandingData } from "./landing-data";
import type { ResolvedDashboardType } from "./dashboard-config";

export function PublicLanding({
  slug,
  initialLanding,
  dashboardType,
}: {
  slug: string;
  initialLanding: LandingData;
  dashboardType: ResolvedDashboardType;
}) {
  return (
    <LandingCanvas
      data={normalizeLandingData(initialLanding)}
      slug={slug}
      submissionType={dashboardType}
    />
  );
}
