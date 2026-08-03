import { getD1 } from "../db";
import {
  canManageCompany,
  getCompanyContextForUser,
  type CompanyContext,
} from "./company-data";
import {
  getCurrentDatabaseUser,
  type DatabaseUser,
} from "./server-user";

export type AuthenticatedCompanyContext = {
  user: DatabaseUser;
  company: CompanyContext;
};

export async function getAuthenticatedCompanyContext(): Promise<
  AuthenticatedCompanyContext | null
> {
  const user = await getCurrentDatabaseUser();
  if (!user) return null;
  const company = await getCompanyContextForUser(user);
  return { user, company };
}

export async function getAccessibleProject(
  auth: AuthenticatedCompanyContext,
  projectId: string,
  options: { companyManager?: boolean } = {}
) {
  const project = await getD1()
    .prepare(
      `SELECT id, owner_id, company_id, name, slug, status, deleted_at
       FROM projects
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(projectId)
    .first<{
      id: string;
      owner_id: string | null;
      company_id: string | null;
      name: string;
      slug: string;
      status: string;
      deleted_at: string | null;
    }>();
  if (!project) return null;

  const sameCompany =
    project.company_id === auth.company.companyId ||
    (!project.company_id && project.owner_id === auth.user.id);
  if (!sameCompany) return null;

  const ownsProject = project.owner_id === auth.user.id;
  if (
    !ownsProject &&
    (!options.companyManager || !canManageCompany(auth.company.role))
  ) {
    return null;
  }
  return project;
}

export function unauthorizedCompanyResponse() {
  return Response.json(
    { error: "Đăng nhập để truy cập dữ liệu công ty." },
    { status: 401 }
  );
}

export function forbiddenCompanyResponse() {
  return Response.json(
    { error: "Bạn không có quyền thực hiện thao tác này." },
    { status: 403 }
  );
}
