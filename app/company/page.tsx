import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  canManageCompany,
  ensureCompanyForUser,
} from "../company-data";
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
  const company = await ensureCompanyForUser(user);
  if (!canManageCompany(company.role)) {
    redirect("/");
  }
  return (
    <CompanyDashboard
      currentUserId={user.id}
      userName={user.name || user.email}
      userEmail={user.email}
    />
  );
}
