"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CompanyRole = "owner" | "admin" | "member";

type CompanyInfo = {
  id: string;
  name: string;
  slug: string;
  role: CompanyRole;
  canManage: boolean;
};

type Member = {
  id: string;
  userId: string;
  role: CompanyRole;
  status: string;
  joinedAt: string;
  name: string | null;
  email: string;
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
};

type Invitation = {
  id: string;
  email: string;
  role: CompanyRole;
  expiresAt: string;
  createdAt: string;
};

type CompanyResponse = {
  company?: CompanyInfo;
  members?: Member[];
  projects?: CompanyProject[];
  invitations?: Invitation[];
  error?: string;
};

type EmailServiceStatus = {
  configured: boolean;
  host?: string;
  port?: number;
  fromEmail?: string;
};

function roleLabel(role: CompanyRole) {
  if (role === "owner") return "Chủ công ty";
  if (role === "admin") return "Quản trị viên";
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
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [emailService, setEmailService] =
    useState<EmailServiceStatus>({ configured: false });

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
      setInvitations(result.invitations || []);
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

  async function loadEmailService() {
    try {
      const response = await fetch("/api/integrations/email");
      const result = (await response.json()) as {
        email?: EmailServiceStatus;
      };
      if (response.ok && result.email) {
        setEmailService(result.email);
      }
    } catch {
      setEmailService({ configured: false });
    }
  }

  useEffect(() => {
    void loadCompany();
    void loadEmailService();
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
        project.creatorEmail || "",
      ].some((value) => value.toLocaleLowerCase("vi").includes(keyword));
    });
  }, [projects, search, selectedMemberId]);

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: inviteRole,
          sendEmail: true,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        pending?: boolean;
        inviteUrl?: string;
        emailStatus?: "sent" | "not_configured" | "failed";
        emailError?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể thêm nhân viên.");
      }
      setEmail("");
      setLastInviteUrl(
        result.inviteUrl
          ? new URL(result.inviteUrl, window.location.origin).toString()
          : ""
      );
      setNotice(
        result.message ||
          (result.pending
            ? "Đã tạo lời mời cho nhân viên."
            : "Đã thêm nhân viên vào công ty.")
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

  async function testEmailService() {
    setIsTestingEmail(true);
    setNotice("");
    try {
      const response = await fetch("/api/integrations/email", {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể gửi email kiểm tra.");
      }
      setNotice(`Đã gửi email kiểm tra đến ${userEmail}.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể gửi email kiểm tra."
      );
    } finally {
      setIsTestingEmail(false);
    }
  }

  async function updateRole(member: Member, role: "admin" | "member") {
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
      setNotice(`Đã đổi vai trò của ${member.name || member.email}.`);
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
        `Gỡ ${member.name || member.email} khỏi công ty? Các project đang sở hữu sẽ được chuyển cho chủ công ty.`
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
      setNotice(`Đã gỡ ${member.name || member.email} khỏi công ty.`);
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

  return (
    <main className="company-shell">
      <aside className="company-sidebar">
        <a className="company-logo" href="/">
          <span>✦</span>
          lumo
        </a>
        <p>QUẢN TRỊ CÔNG TY</p>
        <nav>
          <a className="is-active" href="/company">
            <span>⌂</span> Tổng quan
          </a>
          <a href="#members">
            <span>◎</span> Nhân viên
          </a>
          <a href="#projects">
            <span>▦</span> Project
          </a>
          <a href="/dashboard">
            <span>◉</span> Dữ liệu landing page
          </a>
        </nav>
        <div className="company-sidebar-spacer" />
        <a className="company-back" href="/">
          ← Về trình tạo trang
        </a>
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
          <a href="/">+ Tạo landing page</a>
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
            <span>Lời mời chờ</span>
            <strong>{invitations.length}</strong>
            <small>Chờ đăng nhập Google</small>
          </article>
        </div>

        {company?.canManage ? (
          <section className="company-panel company-invite-panel">
            <div>
              <p>THÊM TÀI KHOẢN</p>
              <h2>Mời nhân viên vào công ty</h2>
              <span>
                Nhân viên mới đăng nhập Google bằng đúng email được mời.
              </span>
              <div
                className={`company-email-status${
                  emailService.configured ? " is-connected" : ""
                }`}
              >
                <i />
                {emailService.configured ? (
                  <>
                    <span>
                      SMTP <strong>{emailService.fromEmail}</strong> đã sẵn sàng
                      gửi email tự động.
                    </span>
                    <button
                      type="button"
                      onClick={() => void testEmailService()}
                      disabled={isTestingEmail}
                    >
                      {isTestingEmail ? "Đang gửi…" : "Gửi email thử"}
                    </button>
                  </>
                ) : (
                  <span>
                    SMTP chưa được cấu hình. Hệ thống vẫn tạo link mời dự phòng.
                  </span>
                )}
              </div>
            </div>
            <form onSubmit={inviteMember}>
              <label>
                Email nhân viên
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nhanvien@congty.vn"
                  required
                />
              </label>
              <label>
                Vai trò
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as "admin" | "member")
                  }
                >
                  <option value="member">Nhân viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </label>
              <button type="submit" disabled={isSaving}>
                {isSaving
                  ? emailService.configured
                    ? "Đang gửi…"
                    : "Đang tạo link…"
                  : emailService.configured
                    ? "Gửi lời mời qua email"
                    : "Tạo link mời"}
              </button>
            </form>
            {lastInviteUrl ? (
              <div className="company-invite-link">
                <span>Đường dẫn gửi cho nhân viên</span>
                <input value={lastInviteUrl} readOnly />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastInviteUrl);
                    setNotice("Đã sao chép đường dẫn lời mời.");
                  }}
                >
                  Sao chép link
                </button>
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
                        <b>{(member.name || member.email)[0].toUpperCase()}</b>
                        <span>
                          <strong>{member.name || "Chưa có tên"}</strong>
                          <small>{member.email}</small>
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
                              event.target.value as "admin" | "member"
                            )
                          }
                        >
                          <option value="member">Nhân viên</option>
                          <option value="admin">Quản trị viên</option>
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
                          <button
                            className="company-danger-link"
                            type="button"
                            disabled={isSaving}
                            onClick={() => void removeMember(member)}
                          >
                            Gỡ khỏi công ty
                          </button>
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
                      {member.name || member.email}
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
                        {project.creatorEmail || "—"}
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
