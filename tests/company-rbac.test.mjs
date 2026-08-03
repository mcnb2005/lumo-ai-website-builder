import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships company-scoped RBAC and administration", async () => {
  const [
    schema,
    database,
    companyData,
    companyAccess,
    companyApi,
    companyPage,
    companyDashboard,
    invitationApi,
    joinPage,
    projectsApi,
    publicApi,
    smtpEmail,
    emailApi,
    serverUser,
    homePage,
    joinClient,
    tokenJoinPage,
  ] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/company-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/company-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/company/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/company/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/company/CompanyDashboard.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../app/api/company/invitations/accept/route.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(new URL("../app/company/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/public/[slug]/route.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/smtp-email.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/api/integrations/email/route.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/server-user.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/company/join/CompanyJoin.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/company/join/[token]/page.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(schema, /export const companies/);
  assert.match(schema, /export const companyMembers/);
  assert.match(schema, /export const companyInvitations/);
  assert.match(schema, /export const companyAuditLogs/);
  assert.match(schema, /companyId: text\("company_id"\)/);
  assert.match(schema, /createdById: text\("created_by_id"\)/);
  assert.match(schema, /deletedAt: text\("deleted_at"\)/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS companies/);
  assert.match(database, /ALTER TABLE projects ADD COLUMN company_id/);
  assert.match(companyData, /ensureCompanyForUser/);
  assert.match(companyData, /getExistingCompanyForUser/);
  assert.match(companyData, /canManageCompany/);
  assert.match(companyAccess, /getAccessibleProject/);
  assert.match(companyApi, /export async function GET/);
  assert.match(companyApi, /export async function POST/);
  assert.match(companyApi, /export async function PATCH/);
  assert.match(companyApi, /export async function DELETE/);
  assert.match(companyApi, /projectsTransferredTo/);
  assert.match(companyPage, /requireCurrentDatabaseUser/);
  assert.match(companyPage, /ensureCompanyForUser/);
  assert.match(companyPage, /canManageCompany/);
  assert.match(companyPage, /redirect\("\/"\)/);
  assert.match(companyDashboard, /Mời nhân viên vào công ty/);
  assert.match(companyDashboard, /Toàn bộ landing page/);
  assert.match(companyDashboard, /inviteUrl/);
  assert.match(companyDashboard, /Gửi lời mời qua email/);
  assert.match(companyDashboard, /Sao chép link/);
  assert.match(companyDashboard, /SMTP/);
  assert.match(companyDashboard, /Gửi email thử/);
  assert.doesNotMatch(companyDashboard, /Kết nối Gmail/);
  assert.match(companyApi, /sendSmtpEmail/);
  assert.match(companyApi, /company\/join\/\$\{encodeURIComponent\(inviteToken\)\}/);
  assert.match(companyApi, /<a href="\$\{safeInviteUrl\}"/);
  assert.match(companyApi, /emailStatus/);
  assert.match(companyApi, /member\.reinvited/);
  assert.match(companyApi, /UPDATE company_invitations/);
  assert.match(smtpEmail, /cloudflare:sockets/);
  assert.match(smtpEmail, /export async function sendSmtpEmail/);
  assert.match(smtpEmail, /STARTTLS/);
  assert.match(smtpEmail, /AUTH LOGIN/);
  assert.match(emailApi, /export async function POST/);
  assert.match(emailApi, /Kiểm tra SMTP từ Lumo/);
  assert.match(invitationApi, /confirmTransfer/);
  assert.match(invitationApi, /tokenHash/);
  assert.match(invitationApi, /member\.joined/);
  assert.match(invitationApi, /ON CONFLICT\(company_id, user_id\) DO UPDATE/);
  assert.match(invitationApi, /status = 'active'/);
  assert.match(joinPage, /requireCurrentDatabaseUser/);
  assert.match(serverUser, /getExistingCompanyForUser/);
  assert.doesNotMatch(serverUser, /ensureCompanyForUser/);
  assert.match(homePage, /ensureCompanyForUser/);
  assert.match(joinClient, /window\.location\.replace\("\/"\)/);
  assert.match(tokenJoinPage, /params: Promise<\{ token: string \}>/);
  assert.match(projectsApi, /writeCompanyAudit/);
  assert.match(projectsApi, /status: "archived"/);
  assert.match(publicApi, /isNull\(projects\.deletedAt\)/);
});
