import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { LeadDashboard } from "./LeadDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản lý khách hàng",
  description: "Theo dõi và xử lý khách hàng tiềm năng từ các landing page.",
};

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");

  return (
    <LeadDashboard
      user={{
        email: user.email,
        name: user.fullName || user.displayName || user.email,
      }}
    />
  );
}
