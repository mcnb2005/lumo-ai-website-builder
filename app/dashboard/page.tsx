import type { Metadata } from "next";
import { requireCurrentDatabaseUser } from "../server-user";
import { LeadDashboard } from "./LeadDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản lý khách hàng",
  description: "Theo dõi và xử lý khách hàng tiềm năng từ các landing page.",
};

export default async function DashboardPage() {
  const user = await requireCurrentDatabaseUser("/dashboard");

  return (
    <LeadDashboard
      user={{
        email: user.email,
        name: user.name || user.email,
        companyRole: user.companyRole,
      }}
    />
  );
}
