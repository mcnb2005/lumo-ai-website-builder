"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  dashboardConfigs,
  dashboardTypeOptions,
  type DashboardType,
  type ResolvedDashboardType,
  type WorkflowStatus,
} from "../dashboard-config";

type Lead = {
  id: string;
  values: Record<string, string>;
  status: WorkflowStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dashboardType: DashboardType;
  resolvedDashboardType: ResolvedDashboardType;
  updatedAt: string;
  publishedAt: string | null;
};

type DashboardUser = {
  email: string;
  name: string;
  companyRole?: "owner" | "admin" | "member" | "viewer";
};

type GoogleConnection = {
  connected: boolean;
  email?: string;
};

function findLeadValue(
  values: Record<string, string>,
  patterns: string[]
): string {
  const entry = Object.entries(values).find(([key]) =>
    patterns.some((pattern) => key.toLowerCase().includes(pattern))
  );
  return entry?.[1]?.trim() || "";
}

function leadName(lead: Lead) {
  return (
    findLeadValue(lead.values, [
      "ho_va_ten",
      "ho_ten",
      "full_name",
      "name",
      "ten_",
    ]) ||
    Object.values(lead.values).find(Boolean) ||
    "Chưa có tên"
  );
}

function leadPhone(lead: Lead) {
  return findLeadValue(lead.values, [
    "so_dien_thoai",
    "dien_thoai",
    "phone",
    "sdt",
  ]);
}

function leadEmail(lead: Lead) {
  return findLeadValue(lead.values, ["email", "thu_dien_tu"]);
}

function leadNeed(lead: Lead) {
  return findLeadValue(lead.values, [
    "nhu_cau",
    "tin_nhan",
    "message",
    "yeu_cau",
    "noi_dung",
    "san_pham",
    "dich_vu",
    "khoa_hoc",
    "su_kien",
    "tai_lieu",
    "ngay_gio",
  ]);
}

function fieldLabel(value: string) {
  const cleaned = value
    .replace(/_\d+$/, "")
    .replaceAll("_", " ")
    .trim();
  return cleaned.charAt(0).toLocaleUpperCase("vi") + cleaned.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function LeadDashboard({ user }: { user: DashboardUser }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    WorkflowStatus | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState("");
  const [isSavingDashboardType, setIsSavingDashboardType] = useState(false);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnection | null>(null);
  const [isUpdatingGoogle, setIsUpdatingGoogle] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedDashboardType =
    projects.find((project) => project.id === projectId)
      ?.resolvedDashboardType || "leads";

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/projects");
        const result = (await response.json()) as {
          projects?: Project[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Không thể tải danh sách dự án.");
        }
        const items = result.projects || [];
        setProjects(items);
        const requestedProjectId = new URLSearchParams(
          window.location.search
        ).get("projectId");
        const initialProject =
          items.find((project) => project.id === requestedProjectId) || items[0];
        setProjectId(initialProject?.id || "");
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách dự án."
        );
      } finally {
        setIsLoadingProjects(false);
      }
    }

    void loadProjects();
  }, []);

  useEffect(() => {
    async function loadGoogleConnection() {
      try {
        const response = await fetch("/api/integrations/google");
        const result = (await response.json()) as {
          connection?: GoogleConnection;
        };
        if (response.ok) {
          setGoogleConnection(result.connection || { connected: false });
        }
      } catch {
        setGoogleConnection({ connected: false });
      }
    }

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("googleConnected") === "1") {
      window.setTimeout(
        () =>
          setNotice(
            "Đã kết nối Google Calendar cho tài khoản này."
          ),
        0
      );
      currentUrl.searchParams.delete("googleConnected");
      window.history.replaceState(
        null,
        "",
        `${currentUrl.pathname}${currentUrl.search}`
      );
    }
    void loadGoogleConnection();
  }, []);

  useEffect(() => {
    if (!projectId) {
      const resetTimer = window.setTimeout(() => {
        setLeads([]);
        setSelectedLeadId("");
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    async function loadLeads() {
      setIsLoadingLeads(true);
      setNotice("");
      try {
        const resource =
          selectedDashboardType === "orders" ? "orders" : "leads";
        const response = await fetch(
          `/api/${resource}?projectId=${encodeURIComponent(projectId)}`
        );
        const result = (await response.json()) as {
          leads?: Lead[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Không thể tải dữ liệu.");
        }
        const items = result.leads || [];
        setLeads(items);
        setSelectedLeadId((current) =>
          items.some((lead) => lead.id === current)
            ? current
            : items[0]?.id || ""
        );
      } catch (error) {
        setLeads([]);
        setSelectedLeadId("");
        setNotice(
          error instanceof Error ? error.message : "Không thể tải dữ liệu."
        );
      } finally {
        setIsLoadingLeads(false);
      }
    }

    void loadLeads();
  }, [projectId, selectedDashboardType]);

  const currentProject = projects.find((project) => project.id === projectId);
  const resolvedDashboardType =
    currentProject?.resolvedDashboardType || "leads";
  const dashboard = dashboardConfigs[resolvedDashboardType];
  const statusOptions = useMemo(
    () =>
      Object.entries(dashboard.statuses).map(([value, label]) => ({
        value: value as WorkflowStatus,
        label,
      })),
    [dashboard]
  );

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!query) return true;
      return [
        leadName(lead),
        leadPhone(lead),
        leadEmail(lead),
        leadNeed(lead),
        lead.notes,
        ...Object.values(lead.values),
      ].some((value) => value.toLocaleLowerCase("vi").includes(query));
    });
  }, [leads, search, statusFilter]);

  const selectedLead =
    leads.find((lead) => lead.id === selectedLeadId) || null;

  const metrics = useMemo(
    () => ({
      total: leads.length,
      fresh: leads.filter((lead) => lead.status === "new").length,
      active: leads.filter(
        (lead) =>
          lead.status === "contacted" || lead.status === "qualified"
      ).length,
      won: leads.filter((lead) => lead.status === "won").length,
    }),
    [leads]
  );

  async function updateDashboardType(value: DashboardType) {
    if (!currentProject) return;
    setIsSavingDashboardType(true);
    setNotice("");
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentProject.id,
          dashboardType: value,
        }),
      });
      const result = (await response.json()) as {
        dashboardType?: DashboardType;
        resolvedDashboardType?: ResolvedDashboardType;
        error?: string;
      };
      if (
        !response.ok ||
        !result.dashboardType ||
        !result.resolvedDashboardType
      ) {
        throw new Error(result.error || "Không thể đổi loại quản lý.");
      }
      setProjects((current) =>
        current.map((project) =>
          project.id === currentProject.id
            ? {
                ...project,
                dashboardType: result.dashboardType!,
                resolvedDashboardType: result.resolvedDashboardType!,
              }
            : project
        )
      );
      setStatusFilter("all");
      setNotice(
        value === "auto"
          ? `Đã tự nhận diện: ${dashboardConfigs[result.resolvedDashboardType].label}.`
          : `Đã chuyển sang: ${dashboardConfigs[result.resolvedDashboardType].label}.`
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể đổi loại quản lý."
      );
    } finally {
      setIsSavingDashboardType(false);
    }
  }

  async function updateLead(
    lead: Lead,
    changes: Partial<Pick<Lead, "status" | "notes">>
  ) {
    const next = { ...lead, ...changes };
    setSavingLeadId(lead.id);
    setNotice("");
    try {
      const resource =
        resolvedDashboardType === "orders" ? "orders" : "leads";
      const response = await fetch(`/api/${resource}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          projectId,
          status: next.status,
          notes: next.notes,
        }),
      });
      const result = (await response.json()) as {
        lead?: Pick<Lead, "id" | "status" | "notes" | "updatedAt">;
        error?: string;
      };
      if (!response.ok || !result.lead) {
        throw new Error(result.error || "Không thể lưu thay đổi.");
      }
      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, ...result.lead } : item
        )
      );
      setNotice(`Đã lưu thay đổi ${dashboard.recordSingular}.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể lưu thay đổi."
      );
    } finally {
      setSavingLeadId("");
    }
  }

  function updateLeadDraft(id: string, notes: string) {
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? { ...lead, notes } : lead))
    );
  }

  function exportCsv() {
    if (!filteredLeads.length) {
      setNotice(`Không có ${dashboard.recordPlural} phù hợp để xuất.`);
      return;
    }
    const valueKeys = Array.from(
      new Set(filteredLeads.flatMap((lead) => Object.keys(lead.values)))
    );
    const rows = [
      [
        "Mã",
        "Trạng thái",
        "Ghi chú",
        "Ngày gửi",
        ...valueKeys.map(fieldLabel),
      ],
      ...filteredLeads.map((lead) => [
        lead.id,
        dashboard.statuses[lead.status],
        lead.notes,
        formatDate(lead.createdAt),
        ...valueKeys.map((key) => lead.values[key] || ""),
      ]),
    ];
    const csv = `\uFEFF${rows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${dashboard.csvPrefix}-${currentProject?.slug || "lumo"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${filteredLeads.length} ${dashboard.recordPlural}.`);
  }

  async function disconnectGoogle() {
    setIsUpdatingGoogle(true);
    setNotice("");
    try {
      const response = await fetch("/api/integrations/google", {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể ngắt kết nối Google.");
      }
      setGoogleConnection({ connected: false });
      setNotice("Đã ngắt kết nối Google Calendar.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể ngắt kết nối Google."
      );
    } finally {
      setIsUpdatingGoogle(false);
    }
  }

  return (
    <main className={`crm-shell crm-type-${resolvedDashboardType}`}>
      <aside className="crm-sidebar">
        <Link className="crm-logo" href="/" aria-label="Lumo — trang tạo landing page">
          <span aria-hidden="true">✦</span>
          lumo
        </Link>
        <div className="crm-sidebar-label">Quản lý</div>
        <nav aria-label="Điều hướng quản lý">
          <a href="#overview">
            <span aria-hidden="true">⌂</span>
            Tổng quan
          </a>
          <a className="is-active" href="#records">
            <span aria-hidden="true">◎</span>
            {dashboard.navLabel}
          </a>
          {user.companyRole === "owner" || user.companyRole === "admin" ? (
            <Link href="/company">
              <span aria-hidden="true">▦</span>
              Công ty & nhân viên
            </Link>
          ) : null}
        </nav>
        <section className="crm-google-connection" aria-label="Kết nối Google">
          <span>Google Workspace</span>
          {googleConnection?.connected ? (
            <>
              <strong>Đã kết nối</strong>
              <small title={googleConnection.email}>
                {googleConnection.email}
              </small>
              <button
                type="button"
                onClick={() => void disconnectGoogle()}
                disabled={isUpdatingGoogle}
              >
                {isUpdatingGoogle ? "Đang ngắt…" : "Ngắt kết nối"}
              </button>
            </>
          ) : (
            <>
              <small>Tạo lịch giao hàng bằng Google Calendar của bạn.</small>
              <a href="/api/auth/google/start?purpose=workspace&returnTo=%2Fdashboard">
                Kết nối Google Calendar
              </a>
            </>
          )}
        </section>
        <div className="crm-sidebar-spacer" />
        <Link className="crm-back-link" href="/">
          <span aria-hidden="true">←</span>
          Về trình tạo trang
        </Link>
        <div className="crm-user">
          <span>{user.name.slice(0, 1).toLocaleUpperCase("vi")}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      </aside>

      <section className="crm-main">
        <header className="crm-header">
          <div>
            <p>{dashboard.centerLabel}</p>
            <h1>{dashboard.title}</h1>
          </div>
          <div className="crm-context-pickers">
            <div className="crm-project-picker">
              <label htmlFor="crm-project">Landing page</label>
              <select
                id="crm-project"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setStatusFilter("all");
                  setSearch("");
                }}
                disabled={isLoadingProjects || !projects.length}
              >
                {!projects.length ? (
                  <option value="">Chưa có dự án</option>
                ) : null}
                {projects.map((project) => (
                  <option value={project.id} key={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="crm-project-picker crm-type-picker">
              <label htmlFor="crm-dashboard-type">Loại quản lý</label>
              <select
                id="crm-dashboard-type"
                value={currentProject?.dashboardType || "auto"}
                onChange={(event) =>
                  void updateDashboardType(event.target.value as DashboardType)
                }
                disabled={!currentProject || isSavingDashboardType}
              >
                {dashboardTypeOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>
                {currentProject?.dashboardType === "auto"
                  ? `Đang nhận diện: ${dashboard.label}`
                  : "Đã chọn thủ công"}
              </small>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="crm-notice" role="status">
            <span aria-hidden="true">●</span>
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        ) : null}

        <section
          className="crm-overview"
          id="overview"
          aria-label={`Tổng quan ${dashboard.recordPlural}`}
        >
          <article>
            <span>{dashboard.metrics.total}</span>
            <strong>{metrics.total}</strong>
            <small>{dashboard.metrics.totalHint}</small>
          </article>
          <article>
            <span>{dashboard.metrics.fresh}</span>
            <strong>{metrics.fresh}</strong>
            <small>{dashboard.metrics.freshHint}</small>
          </article>
          <article>
            <span>{dashboard.metrics.active}</span>
            <strong>{metrics.active}</strong>
            <small>{dashboard.metrics.activeHint}</small>
          </article>
          <article className="is-success">
            <span>{dashboard.metrics.won}</span>
            <strong>{metrics.won}</strong>
            <small>{dashboard.metrics.wonHint}</small>
          </article>
        </section>

        <section className="crm-workspace" id="records">
          <div className="crm-toolbar">
            <div>
              <p>Danh sách {dashboard.recordPlural}</p>
              <span>
                {currentProject?.name || "Chưa chọn dự án"} ·{" "}
                {filteredLeads.length} kết quả
              </span>
            </div>
            <div className="crm-toolbar-actions">
              <label className="crm-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={dashboard.searchPlaceholder}
                  aria-label={`Tìm ${dashboard.recordPlural}`}
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as WorkflowStatus | "all"
                  )
                }
                aria-label="Lọc theo trạng thái"
              >
                <option value="all">Tất cả trạng thái</option>
                {statusOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={exportCsv}>
                ↓ Xuất CSV
              </button>
            </div>
          </div>

          <div className="crm-content">
            <div className="crm-table-wrap">
              {isLoadingLeads || isLoadingProjects ? (
                <div className="crm-state">
                  <span className="crm-loader" aria-hidden="true" />
                  Đang tải dữ liệu…
                </div>
              ) : !projects.length ? (
                <div className="crm-state">
                  <strong>Chưa có landing page</strong>
                  <span>Hãy tạo và lưu một landing page trước.</span>
                  <Link href="/">Tạo landing page</Link>
                </div>
              ) : !filteredLeads.length ? (
                <div className="crm-state">
                  <strong>
                    {leads.length
                      ? `Không tìm thấy ${dashboard.recordSingular}`
                      : dashboard.emptyTitle}
                  </strong>
                  <span>
                    {leads.length
                      ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái."
                      : dashboard.emptyDescription}
                  </span>
                </div>
              ) : (
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>{dashboard.actorLabel}</th>
                      <th>Liên hệ</th>
                      <th>{dashboard.needLabel}</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr
                        className={
                          selectedLeadId === lead.id ? "is-selected" : ""
                        }
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <td>
                          <button
                            className="crm-customer-button"
                            type="button"
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <span>
                              {leadName(lead)
                                .slice(0, 1)
                                .toLocaleUpperCase("vi")}
                            </span>
                            <strong>{leadName(lead)}</strong>
                          </button>
                        </td>
                        <td>
                          <strong>{leadPhone(lead) || "—"}</strong>
                          <small>
                            {leadEmail(lead) || "Chưa có email"}
                          </small>
                        </td>
                        <td>
                          <span className="crm-need">
                            {leadNeed(lead) || "Chưa có nội dung"}
                          </span>
                        </td>
                        <td>
                          <span>{formatDate(lead.createdAt)}</span>
                        </td>
                        <td>
                          <span className={`crm-status is-${lead.status}`}>
                            {dashboard.statuses[lead.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <aside className="crm-detail" aria-label={dashboard.detailLabel}>
              {selectedLead ? (
                <>
                  <header>
                    <span>
                      {leadName(selectedLead)
                        .slice(0, 1)
                        .toLocaleUpperCase("vi")}
                    </span>
                    <div>
                      <small>{dashboard.detailLabel}</small>
                      <h2>{leadName(selectedLead)}</h2>
                    </div>
                  </header>

                  <div className="crm-quick-actions">
                    {leadPhone(selectedLead) ? (
                      <a href={`tel:${leadPhone(selectedLead)}`}>Gọi điện</a>
                    ) : null}
                    {leadEmail(selectedLead) ? (
                      <a href={`mailto:${leadEmail(selectedLead)}`}>
                        Gửi email
                      </a>
                    ) : null}
                  </div>

                  <label className="crm-detail-field">
                    <span>Trạng thái xử lý</span>
                    <select
                      value={selectedLead.status}
                      onChange={(event) =>
                        void updateLead(selectedLead, {
                          status: event.target.value as WorkflowStatus,
                        })
                      }
                      disabled={savingLeadId === selectedLead.id}
                    >
                      {statusOptions.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="crm-form-values">
                    <h3>Thông tin từ form</h3>
                    <dl>
                      {Object.entries(selectedLead.values).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt>{fieldLabel(key)}</dt>
                            <dd>{value || "—"}</dd>
                          </div>
                        )
                      )}
                    </dl>
                  </div>

                  <label className="crm-detail-field crm-notes">
                    <span>{dashboard.notesLabel}</span>
                    <textarea
                      rows={5}
                      value={selectedLead.notes}
                      onChange={(event) =>
                        updateLeadDraft(selectedLead.id, event.target.value)
                      }
                      placeholder={dashboard.notesPlaceholder}
                    />
                  </label>
                  <button
                    className="crm-save-button"
                    type="button"
                    onClick={() => void updateLead(selectedLead, {})}
                    disabled={savingLeadId === selectedLead.id}
                  >
                    {savingLeadId === selectedLead.id
                      ? "Đang lưu…"
                      : "Lưu ghi chú"}
                  </button>
                  <time>
                    Nhận lúc {formatDate(selectedLead.createdAt)}
                  </time>
                </>
              ) : (
                <div className="crm-detail-empty">
                  <span aria-hidden="true">◎</span>
                  <strong>Chọn một {dashboard.recordSingular}</strong>
                  <p>
                    Thông tin chi tiết và công cụ xử lý sẽ hiển thị tại đây.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}
