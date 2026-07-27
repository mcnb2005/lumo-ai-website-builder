"use client";

import { useEffect, useMemo, useState } from "react";

type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

type Lead = {
  id: string;
  values: Record<string, string>;
  status: LeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
};

type DashboardUser = {
  email: string;
  name: string;
};

const statusOptions: Array<{
  value: LeadStatus;
  label: string;
}> = [
  { value: "new", label: "Mới" },
  { value: "contacted", label: "Đã liên hệ" },
  { value: "qualified", label: "Tiềm năng" },
  { value: "won", label: "Đã chốt" },
  { value: "lost", label: "Không phù hợp" },
];

const statusLabels = Object.fromEntries(
  statusOptions.map((option) => [option.value, option.label])
) as Record<LeadStatus, string>;

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
    findLeadValue(lead.values, ["ho_va_ten", "ho_ten", "full_name", "name", "ten_"]) ||
    Object.values(lead.values).find(Boolean) ||
    "Khách hàng chưa đặt tên"
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
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState("");
  const [notice, setNotice] = useState("");

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
    if (!projectId) {
      setLeads([]);
      setSelectedLeadId("");
      return;
    }

    async function loadLeads() {
      setIsLoadingLeads(true);
      setNotice("");
      try {
        const response = await fetch(
          `/api/leads?projectId=${encodeURIComponent(projectId)}`
        );
        const result = (await response.json()) as {
          leads?: Lead[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Không thể tải khách hàng.");
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
          error instanceof Error ? error.message : "Không thể tải khách hàng."
        );
      } finally {
        setIsLoadingLeads(false);
      }
    }

    void loadLeads();
  }, [projectId]);

  const currentProject = projects.find((project) => project.id === projectId);

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

  async function updateLead(
    lead: Lead,
    changes: Partial<Pick<Lead, "status" | "notes">>
  ) {
    const next = { ...lead, ...changes };
    setSavingLeadId(lead.id);
    setNotice("");
    try {
      const response = await fetch("/api/leads", {
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
      setNotice("Đã lưu thay đổi khách hàng.");
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
      setNotice("Không có khách hàng phù hợp để xuất.");
      return;
    }
    const valueKeys = Array.from(
      new Set(filteredLeads.flatMap((lead) => Object.keys(lead.values)))
    );
    const rows = [
      [
        "Mã khách hàng",
        "Trạng thái",
        "Ghi chú",
        "Ngày gửi",
        ...valueKeys.map(fieldLabel),
      ],
      ...filteredLeads.map((lead) => [
        lead.id,
        statusLabels[lead.status],
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
    anchor.download = `khach-hang-${currentProject?.slug || "lumo"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${filteredLeads.length} khách hàng.`);
  }

  return (
    <main className="crm-shell">
      <aside className="crm-sidebar">
        <a className="crm-logo" href="/" aria-label="Lumo — trang tạo landing page">
          <span aria-hidden="true">✦</span>
          lumo
        </a>
        <div className="crm-sidebar-label">Quản lý</div>
        <nav aria-label="Điều hướng quản lý">
          <a href="#overview">
            <span aria-hidden="true">⌂</span>
            Tổng quan
          </a>
          <a className="is-active" href="#customers">
            <span aria-hidden="true">◎</span>
            Khách hàng
          </a>
        </nav>
        <div className="crm-sidebar-spacer" />
        <a className="crm-back-link" href="/">
          <span aria-hidden="true">←</span>
          Về trình tạo trang
        </a>
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
            <p>Trung tâm khách hàng</p>
            <h1>Quản lý liên hệ</h1>
          </div>
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
        </header>

        {notice ? (
          <div className="crm-notice" role="status">
            <span aria-hidden="true">●</span>
            {notice}
            <button type="button" onClick={() => setNotice("")} aria-label="Đóng thông báo">
              ×
            </button>
          </div>
        ) : null}

        <section className="crm-overview" id="overview" aria-label="Tổng quan khách hàng">
          <article>
            <span>Tổng khách hàng</span>
            <strong>{metrics.total}</strong>
            <small>Tất cả liên hệ đã nhận</small>
          </article>
          <article>
            <span>Khách mới</span>
            <strong>{metrics.fresh}</strong>
            <small>Đang chờ xử lý</small>
          </article>
          <article>
            <span>Đang chăm sóc</span>
            <strong>{metrics.active}</strong>
            <small>Đã liên hệ hoặc tiềm năng</small>
          </article>
          <article className="is-success">
            <span>Đã chốt</span>
            <strong>{metrics.won}</strong>
            <small>Khách hàng thành công</small>
          </article>
        </section>

        <section className="crm-workspace" id="customers">
          <div className="crm-toolbar">
            <div>
              <p>Danh sách khách hàng</p>
              <span>
                {currentProject?.name || "Chưa chọn dự án"} · {filteredLeads.length} kết quả
              </span>
            </div>
            <div className="crm-toolbar-actions">
              <label className="crm-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm tên, số điện thoại, email…"
                  aria-label="Tìm khách hàng"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as LeadStatus | "all")
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
                  Đang tải khách hàng…
                </div>
              ) : !projects.length ? (
                <div className="crm-state">
                  <strong>Chưa có landing page</strong>
                  <span>Hãy tạo và lưu một landing page trước.</span>
                  <a href="/">Tạo landing page</a>
                </div>
              ) : !filteredLeads.length ? (
                <div className="crm-state">
                  <strong>
                    {leads.length ? "Không tìm thấy khách hàng" : "Chưa có khách hàng"}
                  </strong>
                  <span>
                    {leads.length
                      ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái."
                      : "Thông tin từ form trên trang đã xuất bản sẽ xuất hiện tại đây."}
                  </span>
                </div>
              ) : (
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Liên hệ</th>
                      <th>Nhu cầu</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr
                        className={selectedLeadId === lead.id ? "is-selected" : ""}
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <td>
                          <button
                            className="crm-customer-button"
                            type="button"
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <span>{leadName(lead).slice(0, 1).toLocaleUpperCase("vi")}</span>
                            <strong>{leadName(lead)}</strong>
                          </button>
                        </td>
                        <td>
                          <strong>{leadPhone(lead) || "—"}</strong>
                          <small>{leadEmail(lead) || "Chưa có email"}</small>
                        </td>
                        <td>
                          <span className="crm-need">{leadNeed(lead) || "Chưa ghi nhu cầu"}</span>
                        </td>
                        <td>
                          <span>{formatDate(lead.createdAt)}</span>
                        </td>
                        <td>
                          <span className={`crm-status is-${lead.status}`}>
                            {statusLabels[lead.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <aside className="crm-detail" aria-label="Chi tiết khách hàng">
              {selectedLead ? (
                <>
                  <header>
                    <span>
                      {leadName(selectedLead)
                        .slice(0, 1)
                        .toLocaleUpperCase("vi")}
                    </span>
                    <div>
                      <small>Chi tiết khách hàng</small>
                      <h2>{leadName(selectedLead)}</h2>
                    </div>
                  </header>

                  <div className="crm-quick-actions">
                    {leadPhone(selectedLead) ? (
                      <a href={`tel:${leadPhone(selectedLead)}`}>Gọi điện</a>
                    ) : null}
                    {leadEmail(selectedLead) ? (
                      <a href={`mailto:${leadEmail(selectedLead)}`}>Gửi email</a>
                    ) : null}
                  </div>

                  <label className="crm-detail-field">
                    <span>Trạng thái xử lý</span>
                    <select
                      value={selectedLead.status}
                      onChange={(event) =>
                        void updateLead(selectedLead, {
                          status: event.target.value as LeadStatus,
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
                      {Object.entries(selectedLead.values).map(([key, value]) => (
                        <div key={key}>
                          <dt>{fieldLabel(key)}</dt>
                          <dd>{value || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <label className="crm-detail-field crm-notes">
                    <span>Ghi chú chăm sóc</span>
                    <textarea
                      rows={5}
                      value={selectedLead.notes}
                      onChange={(event) =>
                        updateLeadDraft(selectedLead.id, event.target.value)
                      }
                      placeholder="Ví dụ: Đã gọi lúc 10:30, khách quan tâm gói cao cấp…"
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
                  <strong>Chọn một khách hàng</strong>
                  <p>Thông tin chi tiết và công cụ xử lý sẽ hiển thị tại đây.</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}
