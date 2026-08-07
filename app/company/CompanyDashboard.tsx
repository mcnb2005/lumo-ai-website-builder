"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type CompanyRole = "owner" | "admin" | "member" | "viewer";

type CompanyInfo = {
  id: string;
  name: string;
  slug: string;
  role: CompanyRole;
  canManage: boolean;
  canCreateLanding: boolean;
};

type Member = {
  id: string;
  userId: string;
  role: CompanyRole;
  status: string;
  joinedAt: string;
  name: string | null;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  projectCount: number;
};

type CompanyProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dashboardType: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  ownerId: string;
  createdById: string | null;
  creatorName: string;
  creatorEmail: string | null;
  creatorUsername: string | null;
};

type CompanyResponse = {
  company?: CompanyInfo;
  members?: Member[];
  projects?: CompanyProject[];
  error?: string;
};

type Credentials = {
  memberId: string;
  username: string;
  name: string;
  temporaryPassword: string;
};

type BulkAccountDraft = {
  username?: string;
  email?: string;
  name?: string;
  role?: "admin" | "member" | "viewer";
};

type BulkFailure = {
  index: number;
  username: string;
  error: string;
};

function csvHeaderKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function roleFromCell(value: string): BulkAccountDraft["role"] {
  const key = csvHeaderKey(value);
  if (key === "admin" || key === "quan_tri_vien") return "admin";
  if (key === "viewer" || key === "chi_xem") return "viewer";
  if (key === "member" || key === "nhan_vien") return "member";
  return undefined;
}

function splitCsvLine(line: string) {
  const delimiter = line.includes(";") && !line.includes(",") ? ";" : ",";
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function parseBulkAccounts(value: string): BulkAccountDraft[] {
  const rows = value
    .split(/\r?\n/)
    .map((line) => splitCsvLine(line.trim().replace(/^\uFEFF/, "")))
    .filter((cells) => cells.some(Boolean));
  if (!rows.length) return [];

  const firstRow = rows[0].map(csvHeaderKey);
  const hasHeader = firstRow.some((cell) =>
    [
      "username",
      "ten_dang_nhap",
      "tai_khoan",
      "email",
      "mail",
      "name",
      "ten",
      "ten_nhan_vien",
      "ho_ten",
      "role",
      "vai_tro",
    ].includes(cell)
  );
  const headers = hasHeader ? firstRow : null;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((cells) => {
      const account: BulkAccountDraft = {};
      if (headers) {
        headers.forEach((header, index) => {
          const cell = cells[index]?.trim();
          if (!cell) return;
          if (
            header === "username" ||
            header === "ten_dang_nhap" ||
            header === "tai_khoan"
          ) {
            if (cell.includes("@")) account.email = cell;
            else account.username = cell;
          }
          if (header === "email" || header === "mail") account.email = cell;
          if (
            header === "name" ||
            header === "ten" ||
            header === "ten_nhan_vien" ||
            header === "ho_ten"
          ) {
            account.name = cell;
          }
          if (header === "role" || header === "vai_tro") {
            account.role = roleFromCell(cell);
          }
        });
        return account;
      }

      const firstCell = cells[0]?.trim() || "";
      if (firstCell.includes("@")) account.email = firstCell;
      else account.username = firstCell;
      account.name = cells[1]?.trim() || undefined;
      account.role = roleFromCell(cells[2] || "");
      return account;
    })
    .filter((account) => account.username || account.email);
}

function roleLabel(role: CompanyRole) {
  if (role === "owner") return "Chủ công ty";
  if (role === "admin") return "Quản trị viên";
  if (role === "viewer") return "Chỉ xem";
  return "Nhân viên";
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function CompanyDashboard({
  currentUserId,
  userName,
  userEmail,
}: {
  currentUserId: string;
  userName: string;
  userEmail: string;
}) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<CompanyProject[]>([]);
  const [username, setUsername] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [inviteRole, setInviteRole] =
    useState<"admin" | "member" | "viewer">("member");
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credentials[]>([]);
  const [bulkAccountsText, setBulkAccountsText] = useState("");
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);

  async function loadCompany() {
    try {
      const response = await fetch("/api/company");
      const result = (await response.json()) as CompanyResponse;
      if (!response.ok || !result.company) {
        throw new Error(result.error || "Không thể tải dữ liệu công ty.");
      }
      setCompany(result.company);
      setMembers(result.members || []);
      setProjects(result.projects || []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu công ty."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCompany();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return projects.filter((project) => {
      if (
        selectedMemberId !== "all" &&
        project.createdById !== selectedMemberId
      ) {
        return false;
      }
      if (!keyword) return true;
      return [
        project.name,
        project.slug,
        project.creatorName,
        project.creatorUsername || "",
        project.creatorEmail || "",
      ].some((value) => value.toLocaleLowerCase("vi").includes(keyword));
    });
  }, [projects, search, selectedMemberId]);

  const bulkAccounts = useMemo(
    () => parseBulkAccounts(bulkAccountsText).slice(0, 100),
    [bulkAccountsText]
  );

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim()) return;
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name: employeeName,
          role: inviteRole,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        memberId?: string;
        username?: string;
        name?: string;
        temporaryPassword?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể thêm nhân viên.");
      }
      setUsername("");
      setEmployeeName("");
      setBulkFailures([]);
      setCredentials(
        result.temporaryPassword
          ? [
              {
                memberId: result.memberId || "",
                username: result.username || username,
                name: result.name || employeeName || result.username || username,
                temporaryPassword: result.temporaryPassword,
              },
            ]
          : []
      );
      setNotice(
        result.message ||
          "Đã cấp tài khoản và mật khẩu tạm cho nhân viên."
      );
      await loadCompany();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể thêm nhân viên."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function inviteBulkMembers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bulkAccounts.length) {
      setNotice("Chưa có tài khoản nào để tạo.");
      return;
    }
    setIsSaving(true);
    setNotice("");
    setBulkFailures([]);
    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accounts: bulkAccounts,
          role: inviteRole,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        credentials?: Credentials[];
        failures?: BulkFailure[];
      };
      if (!response.ok && !result.credentials?.length) {
        throw new Error(result.error || "Không thể tạo nhiều tài khoản.");
      }
      setCredentials(result.credentials || []);
      setBulkFailures(result.failures || []);
      setBulkAccountsText("");
      setBulkFileName("");
      setNotice(
        result.message ||
          `Đã cấp ${result.credentials?.length || 0} tài khoản nhân viên.`
      );
      await loadCompany();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể tạo nhiều tài khoản."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setBulkFileName(file.name);
      setBulkAccountsText(content);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể đọc file CSV."
      );
    } finally {
      input.value = "";
    }
  }

  function loginUrl() {
    if (typeof window === "undefined") return "/login";
    return `${window.location.origin}/login`;
  }

  function loginMessage(credential: Credentials) {
    return [
      "Chào bạn, bạn đã được cấp tài khoản Lumo.",
      "",
      `Link đăng nhập: ${loginUrl()}`,
      `Tên đăng nhập: ${credential.username}`,
      `Mật khẩu tạm: ${credential.temporaryPassword}`,
      "",
      "Khi đăng nhập lần đầu, hệ thống sẽ yêu cầu bạn đổi mật khẩu.",
    ].join("\n");
  }

  async function copyLoginMessage() {
    if (!credentials.length) return;
    await navigator.clipboard.writeText(
      credentials.map(loginMessage).join("\n\n---\n\n")
    );
    setNotice(
      credentials.length > 1
        ? `Đã sao chép ${credentials.length} tin nhắn đăng nhập.`
        : "Đã sao chép tin nhắn đăng nhập."
    );
  }

  async function resetPassword(member: Member | Credentials) {
    const memberId = "memberId" in member ? member.memberId : member.id;
    if (!memberId) return;
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword", memberId }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        username?: string;
        name?: string;
        temporaryPassword?: string;
      };
      if (!response.ok || !result.temporaryPassword) {
        throw new Error(result.error || "Không thể tạo lại mật khẩu.");
      }
      setBulkFailures([]);
      setCredentials([
        {
          memberId,
          username:
            result.username ||
            ("username" in member ? member.username : "") ||
            ("email" in member ? member.email : ""),
          name:
            result.name ||
            ("name" in member ? member.name || "" : "") ||
            result.username ||
            "",
          temporaryPassword: result.temporaryPassword,
        },
      ]);
      setNotice(result.message || "Đã tạo lại mật khẩu tạm.");
      await loadCompany();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể tạo lại mật khẩu."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRole(
    member: Member,
    role: "admin" | "member" | "viewer"
  ) {
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, role }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể cập nhật vai trò.");
      }
      setNotice(
        `Đã đổi vai trò của ${member.name || member.username || member.email}.`
      );
      await loadCompany();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật vai trò."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeMember(member: Member) {
    if (
      !window.confirm(
        `Gỡ ${member.name || member.username || member.email} khỏi công ty? Các project đang sở hữu sẽ được chuyển cho chủ công ty.`
      )
    ) {
      return;
    }
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/company?memberId=${encodeURIComponent(member.id)}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa nhân viên.");
      }
      setNotice(
        `Đã gỡ ${member.name || member.username || member.email} khỏi công ty.`
      );
      await loadCompany();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể xóa nhân viên."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProject(project: CompanyProject) {
    if (
      !window.confirm(
        `Xóa project “${project.name}”? Project sẽ được lưu trữ và không còn xuất bản công khai.`
      )
    ) {
      return;
    }
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/projects?id=${encodeURIComponent(project.id)}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa project.");
      }
      setNotice(`Đã xóa project ${project.name}.`);
      await loadCompany();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể xóa project."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const activeProjects = projects.length;
  const publishedProjects = projects.filter(
    (project) => project.status === "published"
  ).length;
  const viewerMembers = members.filter((member) => member.role === "viewer")
    .length;

  return (
    <main className="company-shell">
      <aside className="company-sidebar">
        <Link className="company-logo" href="/">
          <span>✦</span>
          lumo
        </Link>
        <p>QUẢN TRỊ CÔNG TY</p>
        <nav>
          <Link className="is-active" href="/company">
            <span>⌂</span> Tổng quan
          </Link>
          <a href="#members">
            <span>◎</span> Nhân viên
          </a>
          <a href="#projects">
            <span>▦</span> Project
          </a>
          <Link href="/dashboard">
            <span>◉</span> Dữ liệu landing page
          </Link>
        </nav>
        <div className="company-sidebar-spacer" />
        <Link className="company-back" href="/">
          ← Về trình tạo trang
        </Link>
        <div className="company-user">
          <span>{userName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{userName}</strong>
            <small>{userEmail}</small>
          </div>
        </div>
      </aside>

      <section className="company-main">
        <header className="company-header">
          <div>
            <p>KHÔNG GIAN LÀM VIỆC</p>
            <h1>{company?.name || "Công ty"}</h1>
            <span>
              Vai trò của bạn: {company ? roleLabel(company.role) : "Đang tải"}
            </span>
          </div>
          {company?.canCreateLanding ? (
            <Link href="/">+ Tạo landing page</Link>
          ) : null}
        </header>

        {notice ? <div className="company-notice">{notice}</div> : null}

        <div className="company-stats">
          <article>
            <span>Nhân viên</span>
            <strong>{members.length}</strong>
            <small>Tài khoản đang hoạt động</small>
          </article>
          <article>
            <span>Tổng project</span>
            <strong>{activeProjects}</strong>
            <small>Project chưa bị xóa</small>
          </article>
          <article>
            <span>Đã xuất bản</span>
            <strong>{publishedProjects}</strong>
            <small>Landing page đang công khai</small>
          </article>
          <article className="is-accent">
            <span>Chỉ xem</span>
            <strong>{viewerMembers}</strong>
            <small>Tài khoản chỉ xem dashboard</small>
          </article>
        </div>

        {company?.canManage ? (
          <section className="company-panel company-invite-panel">
            <div>
              <p>THÊM TÀI KHOẢN</p>
              <h2>Cấp tài khoản nhân viên</h2>
              <span>
                Tạo tên đăng nhập và mật khẩu tạm, nhân viên sẽ đổi mật khẩu khi đăng nhập lần đầu.
              </span>
            </div>
            <form className="company-account-form" onSubmit={inviteMember}>
              <label>
                Tên nhân viên
                <input
                  type="text"
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  placeholder="Nguyễn Minh Anh"
                />
              </label>
              <label>
                Tên đăng nhập
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="minhanh"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Vai trò
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value as "admin" | "member" | "viewer"
                    )
                  }
                >
                  <option value="member">Nhân viên</option>
                  <option value="admin">Quản trị viên</option>
                  <option value="viewer">Chỉ xem</option>
                </select>
              </label>
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Đang cấp..." : "Cấp tài khoản"}
              </button>
            </form>
            <form className="company-bulk-form" onSubmit={inviteBulkMembers}>
              <label>
                Nhập nhiều username hoặc CSV
                <textarea
                  value={bulkAccountsText}
                  onChange={(event) => {
                    setBulkAccountsText(event.target.value);
                    setBulkFileName("");
                  }}
                  placeholder={
                    "minhanh,Nguyễn Minh Anh\nhello123,Lê An\nviewer01,Trần Bình,viewer"
                  }
                />
              </label>
              <div className="company-bulk-actions">
                <label className="company-file-button">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => void handleBulkCsvUpload(event)}
                  />
                </label>
                <span>
                  {bulkFileName || `${bulkAccounts.length} tài khoản sẵn sàng`}
                </span>
                <button
                  type="submit"
                  disabled={isSaving || !bulkAccounts.length}
                >
                  {isSaving ? "Đang tạo..." : "Tạo hàng loạt"}
                </button>
              </div>
            </form>
            {bulkFailures.length ? (
              <div className="company-bulk-errors">
                <strong>{bulkFailures.length} dòng chưa tạo</strong>
                <ul>
                  {bulkFailures.slice(0, 5).map((failure) => (
                    <li key={`${failure.index}-${failure.username}`}>
                      Dòng {failure.index}: {failure.username} - {failure.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {credentials.length ? (
              <div className="company-credentials-card">
                <div>
                  <p>THÔNG TIN ĐĂNG NHẬP</p>
                  <h3>
                    {credentials.length === 1
                      ? credentials[0].name
                      : `${credentials.length} tài khoản đã tạo`}
                  </h3>
                  <span>Gửi tin nhắn này qua Zalo, Messenger hoặc email.</span>
                </div>
                {credentials.length === 1 ? (
                  <dl>
                    <div>
                      <dt>Link đăng nhập</dt>
                      <dd>{loginUrl()}</dd>
                    </div>
                    <div>
                      <dt>Tên đăng nhập</dt>
                      <dd>{credentials[0].username}</dd>
                    </div>
                    <div>
                      <dt>Mật khẩu tạm</dt>
                      <dd>{credentials[0].temporaryPassword}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="company-credentials-list">
                    {credentials.map((credential) => (
                      <article key={`${credential.memberId}-${credential.username}`}>
                        <strong>{credential.name}</strong>
                        <span>@{credential.username}</span>
                        <code>{credential.temporaryPassword}</code>
                      </article>
                    ))}
                  </div>
                )}
                <div className="company-credentials-message">
                  {credentials.map(loginMessage).join("\n\n---\n\n")}
                </div>
                <div className="company-credentials-actions">
                  <button type="button" onClick={() => void copyLoginMessage()}>
                    Sao chép tin nhắn
                  </button>
                  {credentials.length === 1 ? (
                    <button
                      type="button"
                      className="is-secondary"
                      disabled={isSaving}
                      onClick={() => void resetPassword(credentials[0])}
                    >
                      Tạo lại mật khẩu
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="company-panel" id="members">
          <div className="company-panel-heading">
            <div>
              <p>THÀNH VIÊN</p>
              <h2>Danh sách nhân viên</h2>
            </div>
            <span>{members.length} tài khoản</span>
          </div>
          <div className="company-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Vai trò</th>
                  <th>Project đã tạo</th>
                  <th>Ngày tham gia</th>
                  {company?.canManage ? <th>Thao tác</th> : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="company-person">
                        <b>
                          {(member.name || member.username || member.email)[0].toUpperCase()}
                        </b>
                        <span>
                          <strong>{member.name || "Chưa có tên"}</strong>
                          <small>
                            {member.username ? `@${member.username}` : member.email}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {company?.canManage &&
                      member.role !== "owner" &&
                      member.userId !== currentUserId ? (
                        <select
                          value={member.role}
                          disabled={isSaving}
                          onChange={(event) =>
                            void updateRole(
                              member,
                              event.target.value as
                                | "admin"
                                | "member"
                                | "viewer"
                            )
                          }
                        >
                          <option value="member">Nhân viên</option>
                          <option value="admin">Quản trị viên</option>
                          <option value="viewer">Chỉ xem</option>
                        </select>
                      ) : (
                        <span className={`company-role is-${member.role}`}>
                          {roleLabel(member.role)}
                        </span>
                      )}
                    </td>
                    <td>{Number(member.projectCount) || 0}</td>
                    <td>{formatDate(member.joinedAt)}</td>
                    {company?.canManage ? (
                      <td>
                        {member.role !== "owner" &&
                        member.userId !== currentUserId ? (
                          <div className="company-member-actions">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void resetPassword(member)}
                            >
                              Tạo lại mật khẩu
                            </button>
                            <button
                              className="company-danger-link"
                              type="button"
                              disabled={isSaving}
                              onClick={() => void removeMember(member)}
                            >
                              Gỡ khỏi công ty
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!isLoading && !members.length ? (
                  <tr>
                    <td colSpan={5}>Chưa có thành viên.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="company-panel" id="projects">
          <div className="company-panel-heading company-project-heading">
            <div>
              <p>PROJECT THEO NHÂN VIÊN</p>
              <h2>Toàn bộ landing page</h2>
            </div>
            <div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm project hoặc nhân viên…"
              />
              {company?.canManage ? (
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  <option value="all">Tất cả nhân viên</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.userId}>
                      {member.name || member.username || member.email}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
          <div className="company-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Người tạo</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <strong>{project.name}</strong>
                      <small className="company-project-slug">
                        /p/{project.slug}
                      </small>
                    </td>
                    <td>
                      <strong>{project.creatorName}</strong>
                      <small className="company-project-slug">
                        {project.creatorUsername
                          ? `@${project.creatorUsername}`
                          : project.creatorEmail || "—"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`company-status is-${project.status}`}
                      >
                        {project.status === "published"
                          ? "Đã xuất bản"
                          : "Bản nháp"}
                      </span>
                    </td>
                    <td>{formatDate(project.updatedAt)}</td>
                    <td>
                      <div className="company-row-actions">
                        {project.status === "published" ? (
                          <a
                            href={`/p/${project.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem trang
                          </a>
                        ) : null}
                        {(company?.canManage ||
                          project.ownerId === currentUserId) && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void deleteProject(project)}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && !filteredProjects.length ? (
                  <tr>
                    <td colSpan={5}>Không có project phù hợp.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
