import type { Metadata } from "next";
import { requireCurrentDatabaseUser } from "../server-user";
import { AccountDashboard } from "./AccountDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tài khoản — Lumo",
  description: "Quản lý tài khoản, phiên đăng nhập và dữ liệu Lumo.",
};

export default async function AccountPage() {
  await requireCurrentDatabaseUser("/account");
  return <AccountDashboard />;
}
