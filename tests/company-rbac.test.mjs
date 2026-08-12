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
    passwordAuth,
    passwordLoginApi,
    passwordLoginForm,
    passwordChangeApi,
    accountPasswordPage,
    usernameMigration,
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
    readFile(new URL("../app/password-auth.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/auth/password/login/route.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/login/PasswordLoginForm.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/api/auth/password/change/route.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/account/password/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0010_username_accounts.sql", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(schema, /export const companies/);
  assert.match(schema, /export const companyMembers/);
  assert.match(schema, /export const companyInvitations/);
  assert.match(schema, /export const companyAuditLogs/);
  assert.match(schema, /passwordHash: text\("password_hash"\)/);
  assert.match(schema, /username: text\("username"\)\.unique\(\)/);
  assert.match(schema, /mustChangePassword/);
  assert.match(schema, /companyId: text\("company_id"\)/);
  assert.match(schema, /createdById: text\("created_by_id"\)/);
  assert.match(schema, /deletedAt: text\("deleted_at"\)/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS companies/);
  assert.match(database, /password_hash TEXT/);
  assert.match(database, /username TEXT UNIQUE/);
  assert.match(database, /ALTER TABLE users ADD COLUMN username TEXT/);
  assert.match(database, /users_username_idx/);
  assert.match(database, /must_change_password INTEGER/);
  assert.match(usernameMigration, /ALTER TABLE `users` ADD COLUMN `username` text/);
  assert.match(usernameMigration, /users_username_idx/);
  assert.match(database, /ALTER TABLE projects ADD COLUMN company_id/);
  assert.match(companyData, /ensureCompanyForUser/);
  assert.match(companyData, /getExistingCompanyForUser/);
  assert.match(companyData, /canManageCompany/);
  assert.match(companyData, /canCreateLanding/);
  assert.match(companyData, /viewer/);
  assert.match(companyAccess, /getAccessibleProject/);
  assert.match(companyApi, /export async function GET/);
  assert.match(companyApi, /export async function POST/);
  assert.match(companyApi, /export async function PATCH/);
  assert.match(companyApi, /export async function DELETE/);
  assert.match(companyApi, /projectsTransferredTo/);
  assert.match(companyApi, /generateTemporaryPassword/);
  assert.match(companyApi, /hashPassword/);
  assert.match(companyApi, /normalizeUsername/);
  assert.match(companyApi, /internalEmailForUsername/);
  assert.match(companyApi, /BULK_ACCOUNT_LIMIT/);
  assert.match(companyApi, /createManagedAccount/);
  assert.match(companyApi, /coerceAccountInput/);
  assert.match(companyApi, /accounts\?: unknown/);
  assert.match(companyApi, /createdCount/);
  assert.match(companyApi, /failedCount/);
  assert.match(companyApi, /username\?: string/);
  assert.match(companyApi, /action\?: string/);
  assert.match(companyApi, /resetPassword/);
  assert.match(companyApi, /member\.password_reset/);
  assert.match(companyApi, /DELETE FROM auth_sessions WHERE user_id = \?/);
  assert.match(companyApi, /lower\(u\.username\) = \?/);
  assert.doesNotMatch(companyApi, /Email hoặc vai trò nhân viên/);
  assert.match(companyApi, /member\.account_created/);
  assert.match(companyApi, /must_change_password = 1/);
  assert.match(companyApi, /ON CONFLICT\(company_id, user_id\) DO UPDATE/);
  assert.match(companyPage, /requireCurrentDatabaseUser/);
  assert.match(companyPage, /ensureCompanyForUser/);
  assert.doesNotMatch(companyPage, /canManageCompany/);
  assert.doesNotMatch(companyPage, /redirect\("\/"\)/);
  assert.match(companyDashboard, /temporaryPassword/);
  assert.match(companyDashboard, /parseBulkAccounts/);
  assert.match(companyDashboard, /bulkAccountsText/);
  assert.match(companyDashboard, /company-bulk-form/);
  assert.match(companyDashboard, /Upload CSV/);
  assert.match(companyDashboard, /Tạo hàng loạt/);
  assert.match(companyDashboard, /company-credentials-card/);
  assert.match(companyDashboard, /Sao chép tin nhắn/);
  assert.match(companyDashboard, /Tạo lại mật khẩu/);
  assert.match(companyDashboard, /Link đăng nhập: \$\{loginUrl\(\)\}/);
  assert.match(
    companyDashboard,
    /navigator\.clipboard\.writeText\(\s*credentials\.map\(loginMessage\)/
  );
  assert.match(companyDashboard, /setUsername/);
  assert.match(companyDashboard, /Tên đăng nhập/);
  assert.match(companyDashboard, /employeeName/);
  assert.match(companyDashboard, /canCreateLanding/);
  assert.match(companyDashboard, /viewer/);
  assert.match(companyDashboard, /filteredProjects/);
  assert.doesNotMatch(companyDashboard, /Email nhân viên/);
  assert.doesNotMatch(companyDashboard, /setEmail/);
  assert.doesNotMatch(companyDashboard, /inviteUrl/);
  assert.doesNotMatch(companyDashboard, /SMTP/);
  assert.doesNotMatch(companyApi, /sendSmtpEmail/);
  assert.doesNotMatch(companyApi, /emailStatus/);
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
  assert.match(serverUser, /INNER JOIN users user ON user\.id = session\.user_id/);
  assert.match(serverUser, /LEFT JOIN company_members membership/);
  assert.match(serverUser, /mustChangePassword/);
  assert.match(serverUser, /\/login\?returnTo=/);
  assert.doesNotMatch(serverUser, /ensureCompanyForUser/);
  assert.match(homePage, /ensureCompanyForUser/);
  assert.match(homePage, /canCreateLanding/);
  assert.match(joinClient, /window\.location\.replace\("\/"\)/);
  assert.match(tokenJoinPage, /params: Promise<\{ token: string \}>/);
  assert.match(passwordAuth, /PBKDF2/);
  assert.match(passwordAuth, /generateTemporaryPassword/);
  assert.match(passwordLoginApi, /verifyPassword/);
  assert.match(passwordLoginApi, /identifier\?: string/);
  assert.match(passwordLoginApi, /lower\(username\) = \? OR lower\(email\) = \?/);
  assert.match(passwordLoginApi, /auth_sessions/);
  assert.match(passwordLoginForm, /identifier/);
  assert.match(passwordLoginForm, /Tên đăng nhập/);
  assert.doesNotMatch(passwordLoginForm, /type="email"/);
  assert.match(passwordChangeApi, /must_change_password = 0/);
  assert.match(accountPasswordPage, /PasswordChangeForm/);
  assert.match(projectsApi, /writeCompanyAudit/);
  assert.match(projectsApi, /canCreateLanding/);
  assert.match(projectsApi, /canEditLanding/);
  assert.match(projectsApi, /status: "archived"/);
  assert.match(publicApi, /isNull\(projects\.deletedAt\)/);
});
