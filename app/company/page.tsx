import type { Metadata } from "next";
import { ensureCompanyForUser } from "../company-data";
import { requireCurrentDatabaseUser } from "../server-user";
import { CompanyDashboard } from "./CompanyDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị công ty — Lumo",
  description:
    "Quản lý nhân viên, vai trò và toàn bộ landing page của công ty.",
};

export default async function CompanyPage() {
  const user = await requireCurrentDatabaseUser("/company");
  await ensureCompanyForUser(user);
  return (
    <CompanyDashboard
      currentUserId={user.id}
      userName={user.name || user.email}
      userEmail={user.email}
    />
  );
}
