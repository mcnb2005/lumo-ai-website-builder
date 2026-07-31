import type { Metadata } from "next";
import { requireCurrentDatabaseUser } from "../../../server-user";
import { CompanyJoin } from "../CompanyJoin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tham gia công ty — Lumo",
};

export default async function CompanyJoinTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const routeParams = await params;
  const token = routeParams.token?.trim() || "";
  await requireCurrentDatabaseUser(
    `/company/join/${encodeURIComponent(token)}`
  );
  return <CompanyJoin token={token} />;
}
