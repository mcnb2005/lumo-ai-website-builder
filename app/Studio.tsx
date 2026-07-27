"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LandingCanvas } from "./components/LandingCanvas";
import {
  defaultLanding,
  starterMessages,
  type ChatMessage,
  type LandingData,
} from "./landing-data";

type Device = "desktop" | "tablet" | "mobile";
type SaveState = "saving" | "saved" | "error";

const PROJECT_ID = "lumo-main-project";
const PROJECT_SLUG = "morrow-creative";

const promptSuggestions = [
  "Đổi sang tông màu tím hiện đại",
  "Viết lại tiêu đề ngắn và mạnh hơn",
  "Biến thành landing page cho quán cà phê",
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

export function Studio() {
  const [landing, setLanding] = useState<LandingData>(defaultLanding);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isPublished, setIsPublished] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [history, setHistory] = useState<LandingData[]>([]);
  const [future, setFuture] = useState<LandingData[]>([]);
  const [version, setVersion] = useState(1);
  const [notice, setNotice] = useState("");
  const hydrated = useRef(false);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
    previewScroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await fetch(`/api/projects?id=${PROJECT_ID}`);
        if (!response.ok) return;
        const result = (await response.json()) as {
          project?: {
            data: LandingData;
            messages: ChatMessage[];
            status: string;
            slug: string;
          };
        };
        if (result.project) {
          setLanding(result.project.data);
          setMessages(
            result.project.messages.length
              ? result.project.messages
              : starterMessages
          );
          setIsPublished(result.project.status === "published");
          if (result.project.status === "published") {
            setPublicUrl(`${window.location.origin}/p/${result.project.slug}`);
          }
        }
      } catch {
        // The starter state remains usable if local persistence is still warming up.
      } finally {
        hydrated.current = true;
      }
    }
    loadProject();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: PROJECT_ID,
            name: landing.brand,
            slug: PROJECT_SLUG,
            data: landing,
            messages,
            status: isPublished ? "published" : "draft",
          }),
        });
        setSaveState(response.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [landing, messages, isPublished]);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const previewClass = useMemo(
    () => `preview-frame preview-${device}`,
    [device]
  );

  async function sendPrompt(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || isGenerating) return;

    const userMessage = newMessage("user", prompt);
    setMessages((current) => [...current, userMessage]);
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
      setLanding(result.landing);
      setVersion((current) => current + 1);
      setIsPublished(false);
      setMessages((current) => [
        ...current,
        newMessage(
          "assistant",
          result.message ||
            "Mình đã cập nhật landing page. Bạn có thể tiếp tục yêu cầu chỉnh màu sắc, nội dung hoặc lời kêu gọi hành động."
        ),
      ]);
      if (result.mode === "demo") {
        setNotice(
          "Đang dùng chế độ mẫu. Thêm AI_API_KEY để bật AI tạo nội dung tự do."
        );
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

  async function publish() {
    setNotice("Đang xuất bản landing page…");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: PROJECT_ID,
          name: landing.brand,
          slug: PROJECT_SLUG,
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
        error instanceof Error ? error.message : "Không thể xuất bản lúc này."
      );
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <a className="studio-logo" href="/" aria-label="Lumo — trang chủ">
          <span aria-hidden="true">✦</span>
          lumo
        </a>
        <div className="project-title">
          <strong>{landing.brand} Landing</strong>
          <span>
            <i className={`save-dot is-${saveState}`} />
            {saveState === "saving"
              ? "Đang lưu…"
              : saveState === "error"
                ? "Chưa thể lưu"
                : "Đã lưu tự động"}
          </span>
        </div>
        <div className="header-actions">
          {isPublished && publicUrl ? (
            <a
              className="view-live-button"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Xem trang
            </a>
          ) : null}
          <button className="publish-button" type="button" onClick={publish}>
            <span aria-hidden="true">↗</span>
            Xuất bản
          </button>
          <button className="avatar-button" type="button" aria-label="Tài khoản">
            LN
          </button>
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
                <p className="typing">
                  <span />
                  <span />
                  <span />
                </p>
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
              <button
                type="button"
                onClick={undo}
                disabled={!history.length}
                aria-label="Hoàn tác"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!future.length}
                aria-label="Làm lại"
              >
                ↷
              </button>
              <span />
              <button type="button" aria-label="Thu phóng">90%</button>
            </div>
            <div className="device-controls" aria-label="Kích thước thiết bị">
              <button
                className={device === "desktop" ? "is-active" : ""}
                type="button"
                onClick={() => setDevice("desktop")}
                aria-label="Xem trên máy tính"
              >
                ▱
              </button>
              <button
                className={device === "tablet" ? "is-active" : ""}
                type="button"
                onClick={() => setDevice("tablet")}
                aria-label="Xem trên máy tính bảng"
              >
                ▯
              </button>
              <button
                className={device === "mobile" ? "is-active" : ""}
                type="button"
                onClick={() => setDevice("mobile")}
                aria-label="Xem trên điện thoại"
              >
                ▯
              </button>
            </div>
            <div className="version-pill">
              <span>Phiên bản {version}</span>
              <i />
            </div>
          </div>

          <div className="preview-stage">
            <div className={previewClass}>
              <div className="browser-bar">
                <div><i /><i /><i /></div>
                <p><span>⌕</span> {PROJECT_SLUG}.lumo.site</p>
                <span aria-hidden="true">↻</span>
              </div>
              <div className="preview-scroll" ref={previewScroll}>
                <LandingCanvas data={landing} compact />
              </div>
            </div>
          </div>

          <footer className="preview-footer">
            <span><i /> Bản xem trước trực tiếp</span>
            <span>Thay đổi được lưu tự động</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
