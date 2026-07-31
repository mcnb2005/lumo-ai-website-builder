import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Studio } from "./Studio";
import { ensureCompanyForUser } from "./company-data";
import { getCurrentDatabaseUser } from "./server-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lumo — Tạo landing page bằng AI",
  description:
    "Tạo, chỉnh sửa và xuất bản landing page chuyên nghiệp chỉ bằng hội thoại.",
};

export default async function Home() {
  const user = await getCurrentDatabaseUser();
  if (!user) redirect("/login");
  await ensureCompanyForUser(user);
  return <Studio />;
}
