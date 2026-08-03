import type { Metadata } from "next";
import { requireCurrentDatabaseUser } from "../../server-user";
import { CompanyJoin } from "./CompanyJoin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tham gia công ty — Lumo",
};

export default async function CompanyJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() || "";
  await requireCurrentDatabaseUser(
    `/company/join?token=${encodeURIComponent(token)}`
  );
  return <CompanyJoin token={token} />;
}
