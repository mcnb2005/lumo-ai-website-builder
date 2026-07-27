"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LandingCanvas } from "./components/LandingCanvas";
import {
  defaultLanding,
  normalizeLandingData,
  starterMessages,
  type ChatMessage,
  type LandingData,
} from "./landing-data";

type Device = "desktop" | "tablet" | "mobile";
type SaveState = "guest" | "saving" | "saved" | "error";
type UserInfo = { id: string; email: string; name: string };
type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
};
type LeadEntry = {
  id: string;
  values: Record<string, string>;
  createdAt: string;
};

const GUEST_DRAFT_KEY = "lumo-guest-draft-v2";
const SIGN_IN_URL = "/signin-with-chatgpt?return_to=%2F";
const SIGN_OUT_URL = "/signout-with-chatgpt?return_to=%2F";

const promptSuggestions = [
  "Tạo landing page bán sản phẩm chăm sóc da",
  "Thêm bảng giá hấp dẫn cho ba gói dịch vụ",
  "Viết lại tiêu đề ngắn và mạnh hơn",
];

function newMessage(
  role: ChatMessage["role"],
  content: string
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
  };
}

function makeProjectIdentity() {
  const id = crypto.randomUUID();
  return { id, slug: `lumo-${id.slice(0, 8)}` };
}

export function Studio() {
  const [landing, setLanding] = useState<LandingData>(defaultLanding);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [saveState, setSaveState] = useState<SaveState>("guest");
  const [isPublished, setIsPublished] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [history, setHistory] = useState<LandingData[]>([]);
  const [future, setFuture] = useState<LandingData[]>([]);
  const [version, setVersion] = useState(1);
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [showLeads, setShowLeads] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const saveEnabled = useRef(false);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
    previewScroll.current?.scrollTo({ top: 0, behavior: "auto" });

    async function initialize() {
      let currentUser: UserInfo | null = null;
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const result = (await response.json()) as { user?: UserInfo };
          currentUser = result.user || null;
          setUser(currentUser);
        }
      } catch {
        currentUser = null;
      }

      if (currentUser) {
        try {
          const response = await fetch("/api/projects");
          const result = (await response.json()) as {
            projects?: ProjectSummary[];
          };
          const items = result.projects || [];
          setProjects(items);
          if (items.length) {
            await loadProject(items[0].id);
          } else {
            restoreGuestOrCreate(true);
          }
        } catch {
          restoreGuestOrCreate(true);
          setSaveState("error");
        }
      } else {
        restoreGuestOrCreate(false);
      }
      setAuthReady(true);
      window.setTimeout(() => {
        saveEnabled.current = true;
      }, 0);
    }

    function restoreGuestOrCreate(isSignedIn: boolean) {
      try {
        const raw = window.localStorage.getItem(GUEST_DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            id?: string;
            slug?: string;
            landing?: Partial<LandingData>;
            messages?: ChatMessage[];
          };
          const identity =
            saved.id && saved.slug
              ? { id: saved.id, slug: saved.slug }
              : makeProjectIdentity();
          setProjectId(identity.id);
          setProjectSlug(identity.slug);
          setLanding(normalizeLandingData(saved.landing));
          setMessages(saved.messages?.length ? saved.messages : starterMessages);
          setSaveState(isSignedIn ? "saving" : "guest");
          return;
        }
      } catch {
        // A malformed local draft is replaced with a clean project.
      }
      const identity = makeProjectIdentity();
      setProjectId(identity.id);
      setProjectSlug(identity.slug);
      setLanding(structuredClone(defaultLanding));
      setMessages(starterMessages);
      setSaveState(isSignedIn ? "saving" : "guest");
    }

    void initialize();
  }, []);

  async function loadProject(id: string) {
    saveEnabled.current = false;
    const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`);
    const result = (await response.json()) as {
      project?: {
        id: string;
        slug: string;
        data: LandingData;
        messages: ChatMessage[];
        status: string;
      };
      error?: string;
    };
    if (!response.ok || !result.project) {
      throw new Error(result.error || "Không thể mở dự án.");
    }
    setProjectId(result.project.id);
    setProjectSlug(result.project.slug);
    setLanding(normalizeLandingData(result.project.data));
    setMessages(
      result.project.messages.length
        ? result.project.messages
        : starterMessages
    );
    setIsPublished(result.project.status === "published");
    setPublicUrl(
      result.project.status === "published"
        ? `${window.location.origin}/p/${result.project.slug}`
        : ""
    );
    setHistory([]);
    setFuture([]);
    setVersion(1);
    setSaveState("saved");
    window.setTimeout(() => {
      saveEnabled.current = true;
    }, 0);
  }

  useEffect(() => {
    if (!authReady || !projectId || !saveEnabled.current) return;

    if (!user) {
      window.localStorage.setItem(
        GUEST_DRAFT_KEY,
        JSON.stringify({
          id: projectId,
          slug: projectSlug,
          landing,
          messages,
        })
      );
      setSaveState("guest");
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: projectId,
            name: landing.brand,
            slug: projectSlug,
            data: landing,
            messages,
            status: isPublished ? "published" : "draft",
          }),
        });
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error || "Không thể lưu dự án.");
        }
        setSaveState("saved");
        setProjects((current) => {
          const existing = current.find((project) => project.id === projectId);
          const summary: ProjectSummary = {
            id: projectId,
            name: landing.brand,
            slug: projectSlug,
            status: isPublished ? "published" : "draft",
            updatedAt: new Date().toISOString(),
            publishedAt: existing?.publishedAt || null,
          };
          return existing
            ? current.map((project) =>
                project.id === projectId ? summary : project
              )
            : [summary, ...current];
        });
        window.localStorage.removeItem(GUEST_DRAFT_KEY);
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    authReady,
    isPublished,
    landing,
    messages,
    projectId,
    projectSlug,
    user,
  ]);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const previewClass = useMemo(
    () => `preview-frame preview-${device}`,
    [device]
  );

  function createProject() {
    saveEnabled.current = false;
    const identity = makeProjectIdentity();
    setProjectId(identity.id);
    setProjectSlug(identity.slug);
    setLanding(structuredClone(defaultLanding));
    setMessages(starterMessages);
    setIsPublished(false);
    setPublicUrl("");
    setHistory([]);
    setFuture([]);
    setVersion(1);
    setNotice(
      user
        ? "Đã tạo dự án mới. Thay đổi sẽ được lưu tự động."
        : "Bạn đang dùng thử. Đăng nhập để lưu dự án này."
    );
    window.setTimeout(() => {
      saveEnabled.current = true;
      if (!user) setSaveState("guest");
    }, 0);
  }

  async function sendPrompt(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || isGenerating) return;

    setMessages((current) => [...current, newMessage("user", prompt)]);
    setInput("");
    setIsGenerating(true);
    setNotice("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, current: landing }),
      });
      const result = (await response.json()) as {
        landing?: LandingData;
        message?: string;
        mode?: string;
        error?: string;
      };
      if (!response.ok || !result.landing) {
        throw new Error(result.error || "Không thể tạo nội dung lúc này.");
      }

      setHistory((current) => [...current.slice(-14), landing]);
      setFuture([]);
      setLanding(normalizeLandingData(result.landing));
      setVersion((current) => current + 1);
      setIsPublished(false);
      setMessages((current) => [
        ...current,
        newMessage(
          "assistant",
          result.message ||
            "Mình đã cập nhật landing page. Bạn có thể tiếp tục yêu cầu thay đổi nội dung, section, hình ảnh hoặc màu sắc."
        ),
      ]);
      if (result.mode === "demo") {
        setNotice("AI đang ở chế độ mẫu vì chưa có khóa API.");
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        newMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "Có lỗi xảy ra. Hãy thử lại với một yêu cầu ngắn hơn."
        ),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendPrompt(input);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((current) => [landing, ...current]);
    setLanding(previous);
    setHistory((current) => current.slice(0, -1));
    setVersion((current) => Math.max(1, current - 1));
    setIsPublished(false);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, landing]);
    setLanding(next);
    setFuture((current) => current.slice(1));
    setVersion((current) => current + 1);
    setIsPublished(false);
  }

  async function uploadImage(file: File) {
    if (!user) {
      setNotice("Đăng nhập để tải và lưu ảnh cho dự án.");
      return;
    }
    setIsUploading(true);
    setNotice("Đang tải ảnh lên…");
    try {
      if (saveState === "saving") {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
      const form = new FormData();
      form.set("file", file);
      form.set("projectId", projectId);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const result = (await response.json()) as {
        asset?: { url: string; alt: string };
        error?: string;
      };
      if (!response.ok || !result.asset) {
        throw new Error(result.error || "Không thể tải ảnh lên.");
      }
      setHistory((current) => [...current.slice(-14), landing]);
      setLanding((current) => ({
        ...current,
        heroImage: current.heroImage || result.asset!.url,
        gallery: [
          ...current.gallery,
          {
            url: result.asset!.url,
            alt: result.asset!.alt,
            caption: "",
          },
        ].slice(-8),
      }));
      setIsPublished(false);
      setVersion((current) => current + 1);
      setNotice("Đã thêm ảnh vào Hero và Gallery.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể tải ảnh lên."
      );
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function publish() {
    if (!user) {
      setNotice("Đăng nhập để lưu và xuất bản landing page.");
      window.location.href = SIGN_IN_URL;
      return;
    }
    setNotice("Đang xuất bản landing page…");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId,
          name: landing.brand,
          slug: projectSlug,
          data: landing,
          messages,
        }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Không thể xuất bản.");
      }
      const url = new URL(result.url, window.location.origin).toString();
      setPublicUrl(url);
      setIsPublished(true);
      setNotice("Đã xuất bản. Landing page của bạn đang trực tuyến.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể xuất bản lúc này."
      );
    }
  }

  async function openLeads() {
    if (!user) return;
    setShowLeads(true);
    setIsLoadingLeads(true);
    try {
      const response = await fetch(
        `/api/leads?projectId=${encodeURIComponent(projectId)}`
      );
      const result = (await response.json()) as {
        leads?: LeadEntry[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải danh sách liên hệ.");
      }
      setLeads(result.leads || []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách liên hệ."
      );
    } finally {
      setIsLoadingLeads(false);
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-tools">
          <a className="studio-logo" href="/" aria-label="Lumo — trang chủ">
            <span aria-hidden="true">✦</span>
            lumo
          </a>
          <button className="new-project-button" type="button" onClick={createProject}>
            + Dự án mới
          </button>
        </div>

        <div className="project-title">
          {user && projects.length ? (
            <select
              aria-label="Chọn dự án"
              value={projectId}
              onChange={(event) => {
                void loadProject(event.target.value).catch((error: Error) =>
                  setNotice(error.message)
                );
              }}
            >
              {projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
              {!projects.some((project) => project.id === projectId) ? (
                <option value={projectId}>{landing.brand}</option>
              ) : null}
            </select>
          ) : (
            <strong>{landing.brand} Landing</strong>
          )}
          <span>
            <i className={`save-dot is-${saveState}`} />
            {saveState === "saving"
              ? "Đang lưu…"
              : saveState === "error"
                ? "Chưa thể lưu"
                : saveState === "guest"
                  ? "Bản dùng thử trên thiết bị"
                  : "Đã lưu tự động"}
          </span>
        </div>

        <div className="header-actions">
          {isPublished && publicUrl ? (
            <a className="view-live-button" href={publicUrl} target="_blank" rel="noreferrer">
              Xem trang
            </a>
          ) : null}
          <button className="publish-button" type="button" onClick={publish}>
            <span aria-hidden="true">↗</span>
            Xuất bản
          </button>
          {authReady && user ? (
            <>
              <button className="leads-button" type="button" onClick={openLeads}>
                Liên hệ
              </button>
              <span className="account-chip" title={user.email}>
                <b>{user.name.slice(0, 1).toUpperCase()}</b>
                <small>{user.name}</small>
              </span>
              <a className="signout-link" href={SIGN_OUT_URL}>Thoát</a>
            </>
          ) : (
            <a className="signin-button" href={SIGN_IN_URL}>Đăng nhập để lưu</a>
          )}
        </div>
      </header>

      <div className="studio-body">
        <aside className="chat-panel">
          <div className="chat-heading">
            <div>
              <span className="ai-badge" aria-hidden="true">✦</span>
              <div>
                <strong>Lumo AI</strong>
                <span><i /> Sẵn sàng thiết kế</span>
              </div>
            </div>
            <button type="button" aria-label="Tùy chọn hội thoại">•••</button>
          </div>

          <div className="conversation" aria-live="polite">
            <div className="day-label">Hôm nay</div>
            {messages.map((message) => (
              <div className={`message message-${message.role}`} key={message.id}>
                {message.role === "assistant" ? (
                  <span className="message-avatar" aria-hidden="true">✦</span>
                ) : null}
                <p>{message.content}</p>
              </div>
            ))}
            {isGenerating ? (
              <div className="message message-assistant">
                <span className="message-avatar" aria-hidden="true">✦</span>
                <p className="typing"><span /><span /><span /></p>
              </div>
            ) : null}
            <div ref={conversationEnd} />
          </div>

          <div className="suggestions" aria-label="Gợi ý câu lệnh">
            {promptSuggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => void sendPrompt(suggestion)}
                disabled={isGenerating}
              >
                <span aria-hidden="true">↗</span>
                {suggestion}
              </button>
            ))}
          </div>

          <div className="composer-tools">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? "Đang tải ảnh…" : "＋ Thêm ảnh"}
            </button>
            <span>JPG, PNG, WebP · tối đa 5 MB</span>
          </div>

          <form className="chat-composer" onSubmit={onSubmit}>
            <label htmlFor="chat-prompt" className="sr-only">
              Yêu cầu Lumo chỉnh landing page
            </label>
            <textarea
              id="chat-prompt"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (input.trim()) void sendPrompt(input);
                }
              }}
              placeholder="Mô tả landing page hoặc yêu cầu chỉnh sửa…"
              rows={3}
            />
            <div>
              <span>Enter để gửi · Shift + Enter xuống dòng</span>
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                aria-label="Gửi yêu cầu"
              >
                ↑
              </button>
            </div>
          </form>
          {notice ? <p className="studio-notice">{notice}</p> : null}
        </aside>

        <section className="preview-panel" aria-label="Bản xem trước landing page">
          <div className="preview-toolbar">
            <div className="history-controls">
              <button type="button" onClick={undo} disabled={!history.length} aria-label="Hoàn tác">↶</button>
              <button type="button" onClick={redo} disabled={!future.length} aria-label="Làm lại">↷</button>
              <span />
              <button type="button" aria-label="Thu phóng">90%</button>
            </div>
            <div className="device-controls" aria-label="Kích thước thiết bị">
              <button className={device === "desktop" ? "is-active" : ""} type="button" onClick={() => setDevice("desktop")} aria-label="Xem trên máy tính">▱</button>
              <button className={device === "tablet" ? "is-active" : ""} type="button" onClick={() => setDevice("tablet")} aria-label="Xem trên máy tính bảng">▯</button>
              <button className={device === "mobile" ? "is-active" : ""} type="button" onClick={() => setDevice("mobile")} aria-label="Xem trên điện thoại">▯</button>
            </div>
            <div className="version-pill"><span>Phiên bản {version}</span><i /></div>
          </div>

          <div className="preview-stage">
            <div className={previewClass}>
              <div className="browser-bar">
                <div><i /><i /><i /></div>
                <p><span>⌕</span> {projectSlug || "ban-nhap"}.lumo.site</p>
                <span aria-hidden="true">↻</span>
              </div>
              <div className="preview-scroll" ref={previewScroll}>
                <LandingCanvas data={landing} compact slug={projectSlug} />
              </div>
            </div>
          </div>

          <footer className="preview-footer">
            <span><i /> Bản xem trước trực tiếp</span>
            <span>{user ? "Thay đổi được lưu tự động" : "Đăng nhập để lưu và xuất bản"}</span>
          </footer>
        </section>
      </div>

      {showLeads ? (
        <div className="leads-backdrop" role="presentation" onMouseDown={() => setShowLeads(false)}>
          <section
            className="leads-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leads-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Khách hàng tiềm năng</span>
                <h2 id="leads-title">{landing.brand}</h2>
              </div>
              <button type="button" onClick={() => setShowLeads(false)} aria-label="Đóng">×</button>
            </header>
            {isLoadingLeads ? (
              <p className="leads-empty">Đang tải danh sách…</p>
            ) : leads.length ? (
              <div className="leads-list">
                {leads.map((lead) => (
                  <article key={lead.id}>
                    <time>{new Date(lead.createdAt).toLocaleString("vi-VN")}</time>
                    <dl>
                      {Object.entries(lead.values).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key.replaceAll("_", " ")}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p className="leads-empty">
                Chưa có thông tin liên hệ. Dữ liệu từ form trên trang đã xuất bản sẽ xuất hiện ở đây.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
