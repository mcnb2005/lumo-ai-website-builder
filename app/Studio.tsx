"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { LandingCanvas } from "./components/LandingCanvas";
import { GenerationProgress } from "./editor/GenerationProgress";
import { AiUsageMeter } from "./editor/AiUsageMeter";
import { SectionColorPanel } from "./editor/SectionColorPanel";
import { SectionNavigator } from "./editor/SectionNavigator";
import { PublishSettingsDialog } from "./editor/PublishSettingsDialog";
import {
  VersionHistoryPanel,
  type ProjectVersionDetail,
} from "./editor/VersionHistoryPanel";
import { sectionRegistry } from "./editor/section-registry";
import { NewProjectDialog } from "./templates/NewProjectDialog";
import {
  applyTemplateDesign,
  createBlankLanding,
  createLandingFromTemplate,
} from "./templates/registry";
import {
  applyLandingTextEdit,
  type LandingTextEdit,
} from "./editor/inline-editing";
import type {
  BuilderAgentResult,
  BuilderStreamEvent,
  GenerationStage,
  PipelineResumeState,
} from "./builder-generation";
import { applyLandingOperations } from "./landing-operations";
import {
  defaultLanding,
  normalizeLandingData,
  starterMessages,
  type ChatMessage,
  type LandingData,
  type LandingImageAsset,
  type LandingImageFit,
  type LandingImagePosition,
  type LandingImageTarget,
  type LandingSectionColors,
  type LandingSectionType,
} from "./landing-data";
import {
  createLandingImageDragPayload,
  LUMO_ASSET_DRAG_TYPE,
} from "./image-drag-payload";
import {
  defaultPublishSettings,
  normalizeProjectSlug,
  type ProjectPublishSettings,
} from "./publish-settings";

type Device = "desktop" | "tablet" | "mobile";
type SaveState = "guest" | "saving" | "saved" | "error";
type UserInfo = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isLocal?: boolean;
  companyRole?: "owner" | "admin" | "member" | "viewer";
};
type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
};
type LoadedProject = {
  id: string;
  slug: string;
  data: LandingData;
  messages: ChatMessage[];
  status: string;
  publishSettings: ProjectPublishSettings;
};
type StudioBootstrapResult = {
  projects?: ProjectSummary[];
  project?: LoadedProject | null;
  assets?: LandingImageAsset[];
  error?: string;
};
type ProjectSaveSnapshot = {
  id: string;
  slug: string;
  landing: LandingData;
  messages: ChatMessage[];
  isPublished: boolean;
  publishSettings: ProjectPublishSettings;
};
const GUEST_DRAFT_KEY = "lumo-guest-draft-v2";
const SIGN_IN_URL = "/api/auth/google/start?returnTo=%2F";
const SIGN_OUT_URL = "/api/auth/logout?returnTo=%2F";
const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function supportedImageFiles(files: Iterable<File>) {
  return Array.from(files).filter((file) => file.type in IMAGE_MIME_EXTENSIONS);
}

function clipboardImageFiles(data: DataTransfer) {
  const timestamp = Date.now();
  return Array.from(data.items)
    .filter(
      (item) =>
        item.kind === "file" && item.type in IMAGE_MIME_EXTENSIONS
    )
    .flatMap((item, index) => {
      const image = item.getAsFile();
      if (!image) return [];
      const extension = IMAGE_MIME_EXTENSIONS[image.type];
      return [
        new File(
          [image],
          `anh-dan-${timestamp}-${index + 1}.${extension}`,
          { type: image.type, lastModified: timestamp }
        ),
      ];
    });
}

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

async function readBuilderResponse(
  response: Response,
  onEvent: (event: BuilderStreamEvent) => void
) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const result = (await response.json()) as BuilderAgentResult & {
      error?: string;
    };
    if (!response.ok || !result.landing) {
      throw new Error(result.error || "Không thể tạo nội dung lúc này.");
    }
    return result;
  }

  if (!response.ok || !response.body) {
    throw new Error("Không thể mở luồng cập nhật từ AI.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: BuilderAgentResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data) continue;
      const event = JSON.parse(data) as BuilderStreamEvent;
      onEvent(event);
      if (event.type === "complete") result = event.result;
      if (event.type === "error") throw new Error(event.message);
    }

    if (done) break;
  }

  if (!result) {
    throw new Error("Luồng AI kết thúc trước khi trả về landing page.");
  }
  return result;
}

function ensureSectionVisible(
  landing: LandingData,
  section: LandingSectionType
) {
  const sectionOrder = landing.sectionOrder.includes(section)
    ? landing.sectionOrder
    : landing.sectionOrder.includes("finalCta")
      ? [
          ...landing.sectionOrder.filter((item) => item !== "finalCta"),
          section,
          "finalCta" as const,
        ]
      : [...landing.sectionOrder, section];
  return {
    ...landing,
    sectionOrder,
    hiddenSections: landing.hiddenSections.filter((item) => item !== section),
  };
}

export function Studio({ initialUser }: { initialUser: UserInfo }) {
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
  const [user] = useState<UserInfo | null>(initialUser);
  const [authReady, setAuthReady] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [draftPublishSlug, setDraftPublishSlug] = useState("");
  const [publishSettings, setPublishSettings] = useState<ProjectPublishSettings>(
    defaultPublishSettings
  );
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [previewVersion, setPreviewVersion] =
    useState<ProjectVersionDetail | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAssetDragActive, setIsAssetDragActive] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<LandingImageAsset[]>([]);
  const [referenceAsset, setReferenceAsset] = useState<LandingImageAsset | null>(null);
  const [selectedSection, setSelectedSection] = useState<LandingSectionType | null>(null);
  const [generationStage, setGenerationStage] =
    useState<GenerationStage | null>(null);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);
  const [aiUsageRefreshKey, setAiUsageRefreshKey] = useState(0);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<
    "create" | "switch"
  >("create");
  const [editorReady, setEditorReady] = useState(false);
  const saveEnabled = useRef(false);
  const persistedProjectIdRef = useRef<string | null>(null);
  const projectSaveRequestRef = useRef<{
    projectId: string;
    promise: Promise<void>;
  } | null>(null);
  const activeProjectIdRef = useRef(projectId);
  const assetsLoadedProjectIdRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadImagesRef = useRef<
    (files: File[], target?: LandingImageTarget) => Promise<void>
  >(async () => {});
  const pipelineResumeRef = useRef<PipelineResumeState | null>(null);

  useEffect(() => {
    activeProjectIdRef.current = projectId;
  }, [projectId]);

  const hydrateProject = useCallback(
    (project: LoadedProject, initialAssets: LandingImageAsset[]) => {
      persistedProjectIdRef.current = project.id;
      skipNextSaveRef.current = true;
      assetsLoadedProjectIdRef.current = project.id;
      setProjectId(project.id);
      setProjectSlug(project.slug);
      setDraftPublishSlug(project.slug);
      setPublishSettings(project.publishSettings || defaultPublishSettings);
      setLanding(normalizeLandingData(project.data));
      setMessages(project.messages.length ? project.messages : starterMessages);
      setIsPublished(project.status === "published");
      setPublicUrl(
        project.status === "published"
          ? `${window.location.origin}/p/${project.slug}`
          : ""
      );
      setUploadedAssets(initialAssets);
      setHistory([]);
      setFuture([]);
      setPreviewVersion(null);
      setReferenceAsset(null);
      pipelineResumeRef.current = null;
      setVersion(1);
      setSaveState("saved");
    },
    []
  );

  const loadProject = useCallback(async (id: string) => {
    saveEnabled.current = false;
    persistedProjectIdRef.current = null;
    assetsLoadedProjectIdRef.current = null;
    setUploadedAssets([]);
    const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`);
    const result = (await response.json()) as {
      project?: {
        id: string;
        slug: string;
        data: LandingData;
        messages: ChatMessage[];
        status: string;
        publishSettings: ProjectPublishSettings;
      };
      error?: string;
    };
    if (!response.ok || !result.project) {
      throw new Error(result.error || "Không thể mở dự án.");
    }
    persistedProjectIdRef.current = result.project.id;
    setProjectId(result.project.id);
    setProjectSlug(result.project.slug);
    setDraftPublishSlug(result.project.slug);
    setPublishSettings(
      result.project.publishSettings || defaultPublishSettings
    );
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
    setPreviewVersion(null);
    setReferenceAsset(null);
    pipelineResumeRef.current = null;
    setVersion(1);
    setSaveState("saved");
    window.setTimeout(() => {
      saveEnabled.current = true;
    }, 0);
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
    const currentUrl = new URL(window.location.href);
    const authError = currentUrl.searchParams.get("authError");
    if (authError) {
      window.setTimeout(() => setNotice(authError), 0);
      currentUrl.searchParams.delete("authError");
      window.history.replaceState(
        null,
        "",
        `${currentUrl.pathname}${currentUrl.search}`
      );
    }
    previewScroll.current?.scrollTo({ top: 0, behavior: "auto" });

    async function initialize() {
      try {
        const response = await fetch("/api/projects?bootstrap=1");
        const result = (await response.json()) as StudioBootstrapResult;
        if (!response.ok) {
          throw new Error(result.error || "Không thể tải dự án.");
        }
        const items = result.projects || [];
        setProjects(items);
        if (result.project) {
          hydrateProject(result.project, result.assets || []);
        } else {
          restoreGuestOrCreate(true);
        }
      } catch {
        restoreGuestOrCreate(true);
        setSaveState("error");
      } finally {
        saveEnabled.current = true;
        setAuthReady(true);
        setEditorReady(true);
      }
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
            publishSettings?: ProjectPublishSettings;
          };
          const identity =
            saved.id && saved.slug
              ? { id: saved.id, slug: saved.slug }
              : makeProjectIdentity();
          setProjectId(identity.id);
          setProjectSlug(identity.slug);
          setDraftPublishSlug(identity.slug);
          setLanding(normalizeLandingData(saved.landing));
          setMessages(saved.messages?.length ? saved.messages : starterMessages);
          setPublishSettings(saved.publishSettings || defaultPublishSettings);
          setSaveState(isSignedIn ? "saving" : "guest");
          return;
        }
      } catch {
        // A malformed local draft is replaced with a clean project.
      }
      const identity = makeProjectIdentity();
      setProjectId(identity.id);
      setProjectSlug(identity.slug);
      setDraftPublishSlug(identity.slug);
      setLanding(structuredClone(defaultLanding));
      setMessages(starterMessages);
      setPublishSettings(defaultPublishSettings);
      setSaveState(isSignedIn ? "saving" : "guest");
    }

    void initialize();
  }, [hydrateProject]);

  const persistProject = useCallback(async (snapshot: ProjectSaveSnapshot) => {
    if (!user) return;

    const activeRequest = projectSaveRequestRef.current;
    if (activeRequest?.projectId === snapshot.id) {
      await activeRequest.promise;
    }

    setSaveState("saving");
    const request = (async () => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: snapshot.id,
          name: snapshot.landing.brand,
          slug: snapshot.slug,
          data: snapshot.landing,
          messages: snapshot.messages,
          publishSettings: snapshot.publishSettings,
          status: snapshot.isPublished ? "published" : "draft",
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        updatedAt?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu dự án.");
      }
      if (activeProjectIdRef.current !== snapshot.id) return;

      persistedProjectIdRef.current = snapshot.id;
      setSaveState("saved");
      setProjects((current) => {
        const existing = current.find((project) => project.id === snapshot.id);
        const summary: ProjectSummary = {
          id: snapshot.id,
          name: snapshot.landing.brand,
          slug: snapshot.slug,
          status: snapshot.isPublished ? "published" : "draft",
          updatedAt: result.updatedAt || new Date().toISOString(),
          publishedAt: existing?.publishedAt || null,
        };
        return existing
          ? current.map((project) =>
              project.id === snapshot.id ? summary : project
            )
          : [summary, ...current];
      });
      window.localStorage.removeItem(GUEST_DRAFT_KEY);
    })();

    projectSaveRequestRef.current = {
      projectId: snapshot.id,
      promise: request,
    };
    try {
      await request;
    } catch (error) {
      if (activeProjectIdRef.current === snapshot.id) setSaveState("error");
      throw error;
    } finally {
      if (projectSaveRequestRef.current?.promise === request) {
        projectSaveRequestRef.current = null;
      }
    }
  }, [user]);

  useEffect(() => {
    if (!authReady || !projectId || !saveEnabled.current) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (!user) {
      window.localStorage.setItem(
        GUEST_DRAFT_KEY,
        JSON.stringify({
          id: projectId,
          slug: projectSlug,
          landing,
          messages,
          publishSettings,
        })
      );
      return;
    }

    const snapshot: ProjectSaveSnapshot = {
      id: projectId,
      slug: projectSlug,
      landing,
      messages,
      isPublished,
      publishSettings,
    };
    const timer = window.setTimeout(async () => {
      try {
        await persistProject(snapshot);
      } catch {
        // persistProject already exposes the failed state for the active project.
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    authReady,
    isPublished,
    landing,
    messages,
    publishSettings,
    projectId,
    projectSlug,
    persistProject,
    user,
  ]);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  useEffect(() => {
    if (!user || !projectId) {
      return;
    }
    if (assetsLoadedProjectIdRef.current === projectId) return;

    let cancelled = false;
    void fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}`)
      .then(async (response) => {
        if (!response.ok) return { assets: [] };
        return (await response.json()) as { assets?: LandingImageAsset[] };
      })
      .then((result) => {
        if (!cancelled) {
          assetsLoadedProjectIdRef.current = projectId;
          setUploadedAssets(result.assets || []);
        }
      })
      .catch(() => {
        if (!cancelled) setUploadedAssets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  const previewClass = useMemo(
    () => `preview-frame preview-${device}`,
    [device]
  );
  const previewLanding = useMemo(
    () =>
      previewVersion
        ? normalizeLandingData(previewVersion.data)
        : landing,
    [landing, previewVersion]
  );

  function updateLanding(updater: (current: LandingData) => LandingData) {
    const next = normalizeLandingData(updater(landing));
    if (JSON.stringify(next) === JSON.stringify(landing)) return;
    setHistory((historyItems) => [...historyItems.slice(-14), landing]);
    setFuture([]);
    setLanding(next);
    setVersion((versionValue) => versionValue + 1);
    setIsPublished(false);
  }

  function editLandingText(edit: LandingTextEdit) {
    if (isGenerating) return;
    updateLanding((current) => applyLandingTextEdit(current, edit));
    setNotice("Đã cập nhật nội dung trực tiếp trên bản xem trước.");
  }

  function handleImagePositionChange(target: string, position: string) {
    if (isGenerating) return;
    updateLanding((current) => {
      const next = { ...current };
      if (target === "hero") {
        next.heroImagePosition = position;
      } else if (target.startsWith("portfolio:")) {
        const index = parseInt(target.split(":")[1] || "0", 10);
        if (next.portfolio && next.portfolio[index]) {
          next.portfolio = [...next.portfolio];
          next.portfolio[index] = { ...next.portfolio[index], imagePosition: position };
        }
      } else if (target.startsWith("gallery:")) {
        const index = parseInt(target.split(":")[1] || "0", 10);
        if (next.gallery && next.gallery[index]) {
          next.gallery = [...next.gallery];
          next.gallery[index] = { ...next.gallery[index], imagePosition: position };
        }
      }
      return next;
    });
  }

  function setSectionColor(
    section: LandingSectionType,
    token: keyof LandingSectionColors,
    value: string
  ) {
    if (isGenerating) return;
    updateLanding((current) => ({
      ...current,
      sectionColors: {
        ...current.sectionColors,
        [section]: {
          ...(current.sectionColors[section] ?? {}),
          [token]: value,
        },
      },
    }));
    setNotice(`Đã cập nhật màu riêng cho ${sectionRegistry[section].label}.`);
  }

  function resetSectionColors(section: LandingSectionType) {
    if (isGenerating) return;
    updateLanding((current) => {
      const sectionColors = { ...current.sectionColors };
      delete sectionColors[section];
      return { ...current, sectionColors };
    });
    setNotice(`${sectionRegistry[section].label} đang dùng lại màu toàn trang.`);
  }

  function setImagePresentation(
    target: LandingImageTarget,
    patch: {
      imageFit?: LandingImageFit;
      imagePosition?: LandingImagePosition;
    }
  ) {
    if (isGenerating) return;
    updateLanding((current) => {
      if (target === "hero") {
        return {
          ...current,
          heroImageFit: patch.imageFit ?? current.heroImageFit,
          heroImagePosition:
            patch.imagePosition ?? current.heroImagePosition,
        };
      }

      if (target.startsWith("portfolio:")) {
        const imageIndex = Number(target.split(":")[1]);
        if (!Number.isInteger(imageIndex)) return current;
        return {
          ...current,
          portfolio: current.portfolio.map((item, index) =>
            index === imageIndex ? { ...item, ...patch } : item
          ),
        };
      }

      if (target.startsWith("gallery:") && target !== "gallery:add") {
        const imageIndex = Number(target.split(":")[1]);
        if (!Number.isInteger(imageIndex)) return current;
        return {
          ...current,
          gallery: current.gallery.map((item, index) =>
            index === imageIndex ? { ...item, ...patch } : item
          ),
        };
      }

      return current;
    });
    setNotice("Đã cập nhật cách hiển thị ảnh.");
  }

  function createProject(
    nextLanding: LandingData = structuredClone(defaultLanding),
    projectNotice?: string
  ) {
    saveEnabled.current = false;
    persistedProjectIdRef.current = null;
    const identity = makeProjectIdentity();
    const normalizedLanding = normalizeLandingData(nextLanding);
    setProjectId(identity.id);
    setProjectSlug(identity.slug);
    setDraftPublishSlug(identity.slug);
    setPublishSettings(defaultPublishSettings);
    setPreviewVersion(null);
    setLanding(normalizedLanding);
    setMessages(starterMessages);
    setIsPublished(false);
    setPublicUrl("");
    setUploadedAssets([]);
    setReferenceAsset(null);
    setSelectedSection(null);
    setGenerationStage(null);
    setGenerationMessage("");
    setGenerationErrors([]);
    pipelineResumeRef.current = null;
    setHistory([]);
    setFuture([]);
    setVersion(1);
    setSaveState(user ? "saving" : "guest");
    if (projectNotice) {
      setNotice(projectNotice);
    } else {
    setNotice(
      user
        ? "Đã tạo dự án mới. Thay đổi sẽ được lưu tự động."
        : "Bạn đang dùng thử. Đăng nhập để lưu dự án này."
    );
    }
    window.setTimeout(() => {
      saveEnabled.current = true;
      if (user) {
        void persistProject({
          id: identity.id,
          slug: identity.slug,
          landing: normalizedLanding,
          messages: starterMessages,
          isPublished: false,
          publishSettings: defaultPublishSettings,
        }).catch(() => undefined);
      }
    }, 0);
  }

  function openNewProjectDialog() {
    setTemplateDialogMode("create");
    setNewProjectDialogOpen(true);
  }

  function createProjectWithAi(prompt: string) {
    const startingLanding = createBlankLanding();
    createProject(
      startingLanding,
      "Lumo đang phân tích mục tiêu và chọn template phù hợp từ thư viện."
    );
    setNewProjectDialogOpen(false);
    void sendPrompt(prompt, startingLanding, starterMessages);
  }

  function chooseTemplate(templateId: string) {
    if (templateDialogMode === "switch") {
      updateLanding((current) => applyTemplateDesign(current, templateId));
      setNotice("Đã đổi thiết kế và giữ nguyên nội dung landing page hiện tại.");
    } else {
      createProject(
        createLandingFromTemplate(templateId),
        "Đã tạo project từ template. Bạn có thể chat để thay nội dung mà vẫn giữ bố cục."
      );
    }
    setNewProjectDialogOpen(false);
  }

  function createBlankProject() {
    createProject(
      createBlankLanding(),
      "Đã tạo trang trắng. Hãy thêm section hoặc chat với Lumo để bắt đầu."
    );
    setNewProjectDialogOpen(false);
  }

  function selectSection(section: LandingSectionType) {
    setSelectedSection(section);
    window.setTimeout(() => {
      const target = previewScroll.current?.querySelector<HTMLElement>(`[data-section-id="${section}"]`);
      if (target && previewScroll.current) {
        const top = target.offsetTop - 24;
        previewScroll.current.scrollTo({ top, behavior: "smooth" });
      }
    }, 0);
  }

  function reorderSections(activeId: LandingSectionType, overId: LandingSectionType) {
    if (isGenerating) return;
    updateLanding((current) => {
      const newIndex = current.sectionOrder.indexOf(overId);
      if (newIndex < 0) return current;
      return applyLandingOperations(current, [
        { type: "move_section", section: activeId, toIndex: newIndex },
      ]).landing;
    });
  }

  function toggleSectionVisibility(section: LandingSectionType) {
    if (section === "finalCta") {
      setNotice("Khối kêu gọi hành động cuối trang nên luôn hiển thị.");
      return;
    }

    const isHidden = landing.hiddenSections.includes(section);
    updateLanding(
      (current) =>
        applyLandingOperations(current, [
          isHidden
            ? { type: "show_section", section }
            : {
                type: "hide_section",
                section: section as Exclude<
                  LandingSectionType,
                  "finalCta"
                >,
              },
        ]).landing
    );
    if (!isHidden && selectedSection === section) setSelectedSection(null);
    setNotice(
      `${sectionRegistry[section].label} đã ${
        isHidden ? "được hiển thị lại" : "bị ẩn"
      }.`
    );
  }

  function addSection() {
    if (isGenerating) return;
    const availableSections = (Object.keys(sectionRegistry) as LandingSectionType[]).filter(
      (section) => !landing.sectionOrder.includes(section)
    );
    if (!availableSections.length && landing.hiddenSections.length) {
      const nextSection = landing.hiddenSections[0];
      toggleSectionVisibility(nextSection);
      selectSection(nextSection);
      return;
    }
    if (!availableSections.length) {
      setNotice("Tất cả khối đã có trên trang.");
      return;
    }
    const nextSection = availableSections[0];
    updateLanding(
      (current) =>
        applyLandingOperations(current, [
          { type: "add_section", section: nextSection },
        ]).landing
    );
    setNotice(`${sectionRegistry[nextSection].label} đã được thêm vào trang.`);
  }

  async function sendPrompt(
    rawPrompt: string,
    sourceLanding: LandingData = landing,
    sourceMessages: ChatMessage[] = messages,
    imageReference: LandingImageAsset | null = referenceAsset
  ) {
    const prompt = rawPrompt.trim();
    if ((!prompt && !imageReference) || isGenerating) return;
    const userMessage =
      prompt || "Tạo landing page dựa trên ảnh tham chiếu đã chọn.";

    setMessages((current) => [...current, newMessage("user", userMessage)]);
    setInput("");
    setIsGenerating(true);
    setGenerationStage("understanding");
    setGenerationMessage("Đang đọc yêu cầu của bạn…");
    setGenerationErrors([]);
    setNotice("AI đang phân tích yêu cầu…");
    const activeResume =
      pipelineResumeRef.current?.prompt.trim() === prompt
        ? pipelineResumeRef.current
        : null;
    if (!activeResume) pipelineResumeRef.current = null;
    let receivedCheckpoint = false;

    try {
      if (user && projectId) {
        await persistProject({
          id: projectId,
          slug: projectSlug,
          landing: sourceLanding,
          messages: sourceMessages,
          isPublished,
          publishSettings,
        });
        const snapshotResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/versions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "snapshot" }),
          }
        );
        if (!snapshotResponse.ok) {
          const snapshotResult = (await snapshotResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            snapshotResult?.error ||
              "Chưa thể lưu bản an toàn trước khi AI chỉnh sửa."
          );
        }
      }
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          projectId,
          referenceAssetId: imageReference?.id,
          current: sourceLanding,
          selectedSection,
          history: sourceMessages.slice(-8).map(({ role, content }) => ({
            role,
            content,
          })),
          resume: activeResume,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Không thể tạo nội dung lúc này.");
      }
      const result = await readBuilderResponse(response, (event) => {
        if (event.type === "status") {
          setGenerationStage(event.stage);
          setGenerationMessage(event.message);
          if (event.stage !== "validating") setGenerationErrors([]);
          setNotice(event.message);
        }
        if (event.type === "validation") {
          setGenerationStage("validating");
          setGenerationErrors(event.valid ? [] : event.errors || []);
          setGenerationMessage(
            event.valid
              ? "Dữ liệu hợp lệ, sẵn sàng áp dụng."
              : event.attempt < 2
                ? "Phản hồi chưa hợp lệ, Lumo đang tự sửa…"
                : "Phản hồi chưa vượt qua kiểm tra."
          );
        }
        if (event.type === "checkpoint") {
          if (!receivedCheckpoint) {
            setHistory((items) => [...items.slice(-14), sourceLanding]);
            receivedCheckpoint = true;
          }
          pipelineResumeRef.current = event.resume;
          setLanding(normalizeLandingData(event.landing));
          setFuture([]);
          setVersion((current) => current + 1);
          setIsPublished(false);
          setGenerationStage("generating");
          setGenerationMessage(event.message);
          setNotice(event.message);
        }
        if (event.type === "error") {
          if (event.resume) pipelineResumeRef.current = event.resume;
          setGenerationStage("failed");
          setGenerationMessage(event.message);
        }
        if (event.type === "complete") {
          pipelineResumeRef.current = null;
          setGenerationStage("completed");
          setGenerationMessage(
            event.result.intent.mode === "clarify"
              ? "Lumo cần bạn bổ sung một chi tiết."
              : "Thay đổi đã được kiểm tra và áp dụng."
          );
          setGenerationErrors([]);
        }
      });

      updateLanding(() => result.landing);
      setMessages((current) => [
        ...current,
        newMessage(
          "assistant",
          result.message ||
            "Mình đã cập nhật landing page. Bạn có thể tiếp tục yêu cầu thay đổi nội dung, section, hình ảnh hoặc màu sắc."
        ),
      ]);
      if (imageReference) setReferenceAsset(null);
      setAiUsageRefreshKey((current) => current + 1);
      if (result.intent.mode === "clarify") {
        setNotice("Lumo cần bạn làm rõ yêu cầu trước khi sửa trang.");
      } else if (result.mode === "demo") {
        setNotice("AI đang ở chế độ mẫu vì chưa có khóa API.");
      } else {
        setNotice("Đã cập nhật landing page theo yêu cầu.");
      }
      if (result.changedSections.length === 1) {
        const changedSection = result.changedSections[0];
        if (result.landing.hiddenSections.includes(changedSection)) {
          setSelectedSection(null);
        } else {
          window.setTimeout(() => selectSection(changedSection), 0);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra. Hãy thử lại với một yêu cầu ngắn hơn.";
      setGenerationStage("failed");
      setGenerationMessage(errorMessage);
      setMessages((current) => [
        ...current,
        newMessage("assistant", errorMessage),
      ]);
      setNotice(errorMessage);
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

  function placeUploadedImages(
    assets: LandingImageAsset[],
    target: LandingImageTarget
  ) {
    if (!assets.length) return;
    let targetSection: LandingSectionType = "hero";
    let successMessage = "Đã đặt ảnh vào phần mở đầu.";
    const [primaryAsset, ...remainingAssets] = assets;

    function galleryItemsForAssets(
      gallery: LandingData["gallery"],
      candidates: LandingImageAsset[]
    ) {
      const urls = new Set(gallery.map((item) => item.url));
      return candidates.flatMap((asset) => {
        if (urls.has(asset.url)) return [];
        urls.add(asset.url);
        return [
          {
            url: asset.url,
            alt: asset.alt,
            caption: "",
            imageFit: "cover" as const,
            imagePosition: "center" as const,
          },
        ];
      });
    }

    updateLanding((current) => {
      if (target === "hero") {
        const currentHeroVariant = current.design?.sectionVariants.hero;
        const imageHeroVariant =
          currentHeroVariant && currentHeroVariant !== "centered"
            ? currentHeroVariant
            : current.design?.templateId === "product-modern"
              ? "product-showcase"
              : "split";
        const next = {
          ...current,
          heroImage: primaryAsset.url,
          heroImageFit: "cover" as const,
          heroImagePosition: "center" as const,
          design: current.design
            ? {
                ...current.design,
                sectionVariants: {
                  ...current.design.sectionVariants,
                  hero: imageHeroVariant,
                },
              }
            : current.design,
        };
        const remainingGalleryItems = galleryItemsForAssets(
          current.gallery,
          remainingAssets
        );
        if (!remainingGalleryItems.length) return next;
        targetSection = "gallery";
        successMessage = `Đã đặt 1 ảnh vào Hero và thêm ${remainingGalleryItems.length} ảnh vào thư viện.`;
        return {
          ...ensureSectionVisible(next, "gallery"),
          gallery: [...current.gallery, ...remainingGalleryItems],
        };
      }

      if (target === "gallery:add") {
        targetSection = "gallery";
        const visibleLanding = ensureSectionVisible(current, "gallery");
        const galleryItems = galleryItemsForAssets(current.gallery, assets);
        if (!galleryItems.length) {
          successMessage = "Ảnh này đã có trong thư viện hình ảnh.";
          return visibleLanding;
        }
        successMessage = `Đã thêm ${galleryItems.length} ảnh vào thư viện hình ảnh.`;
        return {
          ...visibleLanding,
          gallery: [...current.gallery, ...galleryItems],
        };
      }

      if (target.startsWith("gallery:")) {
        const imageIndex = Number(target.split(":")[1]);
        targetSection = "gallery";
        successMessage = `Đã thay ảnh thư viện số ${imageIndex + 1}.`;
        const visibleLanding = ensureSectionVisible(current, "gallery");
        const gallery = current.gallery.map((image, index) =>
          index === imageIndex
            ? {
                ...image,
                url: primaryAsset.url,
                alt: primaryAsset.alt,
              }
            : image
        );
        const remainingGalleryItems = galleryItemsForAssets(
          gallery,
          remainingAssets
        );
        return {
          ...visibleLanding,
          gallery: [...gallery, ...remainingGalleryItems],
        };
      }

      const portfolioIndex = Number(target.split(":")[1]);
      targetSection = "portfolio";
      successMessage = `Đã đặt ảnh vào dự án số ${portfolioIndex + 1}.`;
      const visibleLanding = ensureSectionVisible(current, "portfolio");
      const next = {
        ...visibleLanding,
        portfolio: current.portfolio.map((item, index) =>
          index === portfolioIndex
            ? {
                ...item,
                imageUrl: primaryAsset.url,
                imageFit: "cover" as const,
                imagePosition: "center" as const,
              }
          : item
        ),
      };
      const remainingGalleryItems = galleryItemsForAssets(
        current.gallery,
        remainingAssets
      );
      if (!remainingGalleryItems.length) return next;
      successMessage += ` ${remainingGalleryItems.length} ảnh còn lại đã được thêm vào thư viện.`;
      targetSection = "gallery";
      return {
        ...ensureSectionVisible(next, "gallery"),
        gallery: [...current.gallery, ...remainingGalleryItems],
      };
    });

    setNotice(successMessage);
    window.setTimeout(() => selectSection(targetSection), 0);
  }

  function removePlacedImage(target: LandingImageTarget) {
    updateLanding((current) => {
      if (target === "hero") {
        return {
          ...current,
          heroImage: "",
          design: current.design
            ? {
                ...current.design,
                sectionVariants: {
                  ...current.design.sectionVariants,
                  hero: "centered",
                },
              }
            : current.design,
        };
      }
      if (target.startsWith("gallery:") && target !== "gallery:add") {
        const imageIndex = Number(target.split(":")[1]);
        return {
          ...current,
          gallery: current.gallery.filter((_, index) => index !== imageIndex),
        };
      }
      if (target.startsWith("portfolio:")) {
        const portfolioIndex = Number(target.split(":")[1]);
        return {
          ...current,
          portfolio: current.portfolio.map((item, index) =>
            index === portfolioIndex ? { ...item, imageUrl: "" } : item
          ),
        };
      }
      return current;
    });
    setNotice("Đã xóa ảnh khỏi vị trí đã chọn.");
  }

  function reorderGalleryImage(
    source: LandingImageTarget,
    target: LandingImageTarget
  ) {
    if (!source.startsWith("gallery:") || source === "gallery:add") return false;
    if (!target.startsWith("gallery:")) return false;

    const sourceIndex = Number(source.split(":")[1]);
    updateLanding((current) => {
      const targetIndex =
        target === "gallery:add"
          ? Math.max(0, current.gallery.length - 1)
          : Number(target.split(":")[1]);
      if (
        !Number.isInteger(sourceIndex) ||
        !Number.isInteger(targetIndex) ||
        sourceIndex < 0 ||
        targetIndex < 0 ||
        sourceIndex >= current.gallery.length ||
        targetIndex >= current.gallery.length ||
        sourceIndex === targetIndex
      ) {
        return current;
      }
      return {
        ...current,
        gallery: arrayMove(current.gallery, sourceIndex, targetIndex),
      };
    });
    setNotice("Đã thay đổi thứ tự ảnh trong thư viện.");
    window.setTimeout(() => selectSection("gallery"), 0);
    return true;
  }

  async function uploadImages(
    files: File[],
    target?: LandingImageTarget
  ) {
    if (!files.length) return;
    const oversizedFile = files.find((file) => file.size > MAX_IMAGE_SIZE);
    if (oversizedFile) {
      setNotice(`Ảnh ${oversizedFile.name} vượt quá giới hạn 5 MB.`);
      return;
    }
    if (isUploading) {
      setNotice("Ảnh đang được tải lên. Vui lòng chờ một chút.");
      return;
    }
    if (!user) {
      setNotice("Đăng nhập để tải và lưu ảnh cho dự án.");
      return;
    }
    setIsUploading(true);
    setNotice(`Đang tải ${files.length} ảnh lên…`);
    try {
      if (!projectId || !projectSlug) {
        throw new Error("Dự án chưa sẵn sàng để lưu ảnh.");
      }
      if (persistedProjectIdRef.current !== projectId) {
        await persistProject({
          id: projectId,
          slug: projectSlug,
          landing,
          messages,
          isPublished,
          publishSettings,
        });
      }

      const newAssets: LandingImageAsset[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        form.set("projectId", projectId);
        const response = await fetch("/api/assets", {
          method: "POST",
          body: form,
        });
        const responseText = await response.text();
        let result: {
          asset?: LandingImageAsset;
          error?: string;
        };
        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch {
          result = {};
        }
        if (!response.ok || !result.asset) {
          const fallbackMessage =
            response.status === 413
              ? `Ảnh ${file.name} vượt quá giới hạn tải lên 5 MB.`
              : `Không thể tải ảnh ${file.name}.`;
          throw new Error(result.error || fallbackMessage);
        }
        newAssets.push(result.asset);
      }

      setUploadedAssets((current) => [
        ...newAssets,
        ...current.filter(
          (asset) => !newAssets.some((newAsset) => newAsset.url === asset.url)
        ),
      ]);
      if (target) {
        placeUploadedImages(newAssets, target);
      } else {
        setNotice(
          `Đã tải ${newAssets.length} ảnh vào thư viện. Kéo từng ảnh vào đúng vị trí trên bản xem trước.`
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể tải ảnh lên."
      );
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  useEffect(() => {
    uploadImagesRef.current = uploadImages;
  });

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (!event.clipboardData) return;
      const images = clipboardImageFiles(event.clipboardData);
      if (!images.length) return;
      event.preventDefault();
      void uploadImagesRef.current(images);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function publish() {
    if (!user) {
      setNotice("Đăng nhập để lưu và xuất bản landing page.");
      window.location.href = SIGN_IN_URL;
      return;
    }
    const nextSlug = normalizeProjectSlug(draftPublishSlug || projectSlug);
    if (!nextSlug) {
      setNotice("Đường dẫn xuất bản chưa hợp lệ.");
      return;
    }
    setIsPublishing(true);
    setNotice("Đang xuất bản landing page…");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId,
          name: landing.brand,
          slug: nextSlug,
          data: landing,
          messages,
          publishSettings,
        }),
      });
      const result = (await response.json()) as {
        url?: string;
        slug?: string;
        publishSettings?: ProjectPublishSettings;
        error?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Không thể xuất bản.");
      }
      const url = new URL(result.url, window.location.origin).toString();
      const publishedSlug = result.slug || nextSlug;
      setProjectSlug(publishedSlug);
      setDraftPublishSlug(publishedSlug);
      if (result.publishSettings) setPublishSettings(result.publishSettings);
      setPublicUrl(url);
      setIsPublished(true);
      setPublishDialogOpen(false);
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                slug: publishedSlug,
                status: "published",
                publishedAt: new Date().toISOString(),
              }
            : project
        )
      );
      setNotice("Đã xuất bản. Landing page của bạn đang trực tuyến.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể xuất bản lúc này."
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function applyRestoredVersion(restored: ProjectVersionDetail) {
    skipNextSaveRef.current = true;
    setLanding(normalizeLandingData(restored.data));
    setMessages(restored.messages.length ? restored.messages : starterMessages);
    setPublishSettings(restored.publishSettings || defaultPublishSettings);
    setHistory([]);
    setFuture([]);
    setPreviewVersion(null);
    setSelectedSection(null);
    setIsPublished(false);
    setPublicUrl("");
    setVersion(restored.versionNumber);
    setNotice("Đã khôi phục thành bản nháp. Hãy kiểm tra rồi xuất bản lại.");
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, status: "draft", publishedAt: null }
          : project
      )
    );
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-tools">
          <button
            className="studio-logo"
            type="button"
            onClick={() => window.location.assign("/")}
            aria-label="Lumo — trang chủ"
          >
            <span aria-hidden="true">✦</span>
            lumo
          </button>
          <button className="new-project-button" type="button" onClick={openNewProjectDialog}>
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
          <button
            className="publish-button"
            type="button"
            onClick={() => {
              setDraftPublishSlug(projectSlug);
              setPublishDialogOpen(true);
            }}
          >
            <span aria-hidden="true">↗</span>
            Xuất bản
          </button>
          {authReady && user ? (
            <>
              <a
                className="leads-button"
                href={`/dashboard?projectId=${encodeURIComponent(projectId)}`}
              >
                Khách hàng
              </a>
              {user.companyRole === "owner" || user.companyRole === "admin" ? (
                <a className="leads-button" href="/company">
                  Công ty
                </a>
              ) : null}
              <a className="account-chip" title={user.email} href="/account">
                <b>{user.name.slice(0, 1).toUpperCase()}</b>
                <small>
                  {user.name}
                  {user.companyRole === "member"
                    ? " · Nhân viên"
                    : user.companyRole === "viewer"
                      ? " · Người xem"
                      : ""}
                </small>
              </a>
              {!user.isLocal ? (
                <a className="signout-link" href={SIGN_OUT_URL}>Thoát</a>
              ) : null}
            </>
          ) : (
            <a className="signin-button" href={SIGN_IN_URL}>
              Đăng nhập bằng Google
            </a>
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

          {authReady && user ? (
            <AiUsageMeter refreshKey={aiUsageRefreshKey} />
          ) : null}

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
            {generationStage ? (
              <div className="message message-assistant">
                <span className="message-avatar" aria-hidden="true">✦</span>
                <GenerationProgress
                  stage={generationStage}
                  message={generationMessage}
                  validationErrors={generationErrors}
                />
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
              multiple
              hidden
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length) void uploadImages(files);
              }}
            />
            <div
              className={`asset-upload-zone${
                isAssetDragActive ? " is-drag-active" : ""
              }${isUploading ? " is-uploading" : ""}`}
              role="region"
              aria-label="Thư viện ảnh tải lên"
              onDragEnter={(event) => {
                if (!Array.from(event.dataTransfer.types).includes("Files")) {
                  return;
                }
                event.preventDefault();
                setIsAssetDragActive(true);
              }}
              onDragOver={(event) => {
                if (!Array.from(event.dataTransfer.types).includes("Files")) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setIsAssetDragActive(true);
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget;
                if (
                  nextTarget instanceof Node &&
                  event.currentTarget.contains(nextTarget)
                ) {
                  return;
                }
                setIsAssetDragActive(false);
              }}
              onDrop={(event) => {
                if (!event.dataTransfer.files.length) return;
                event.preventDefault();
                setIsAssetDragActive(false);
                const images = supportedImageFiles(event.dataTransfer.files);
                if (!images.length) {
                  setNotice("Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc GIF.");
                  return;
                }
                void uploadImages(images);
              }}
            >
              <div className="asset-library">
                <div className="asset-library-heading">
                  <strong>Ảnh đã tải</strong>
                  <span>Kéo thả để tải lên hoặc click [+]</span>
                </div>
                {uploadedAssets.length ? (
                  <div className="asset-library-list">
                    {uploadedAssets.map((asset) => (
                      <div
                        className={`asset-library-item${
                          referenceAsset?.id === asset.id ? " is-reference" : ""
                        }`}
                        draggable
                        role="group"
                        tabIndex={0}
                        aria-label={`Kéo ảnh ${asset.alt} vào trang`}
                        title={`Kéo ${asset.alt} vào trang`}
                        key={asset.id || asset.url}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "copyMove";
                          const payload = createLandingImageDragPayload(asset);
                          event.dataTransfer.setData(
                            LUMO_ASSET_DRAG_TYPE,
                            payload.custom
                          );
                          event.dataTransfer.setData("text/plain", payload.text);
                        }}
                      >
                        <img src={asset.url} alt={asset.alt} draggable={false} />
                        <button
                          type="button"
                          className="asset-reference-button"
                          aria-pressed={referenceAsset?.id === asset.id}
                          aria-label={`Dùng ${asset.alt} làm ảnh tham chiếu`}
                          title="Dùng làm ảnh tham chiếu"
                          onClick={(event) => {
                            event.stopPropagation();
                            setReferenceAsset(asset);
                            setNotice("Đã chọn ảnh tham chiếu cho lần tạo tiếp theo.");
                          }}
                        >
                          AI
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="asset-library-add-item"
                      onClick={() => fileInput.current?.click()}
                      aria-label="Tải ảnh lên"
                      title="Tải ảnh lên"
                      disabled={isUploading}
                    >
                      {isUploading ? "…" : "+"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="asset-library-empty"
                    onClick={() => fileInput.current?.click()}
                    disabled={isUploading}
                  >
                    <strong>
                      {isUploading
                        ? "Đang tải ảnh…"
                        : isAssetDragActive
                          ? "Thả ảnh để lưu vào thư viện"
                          : "+ Click hoặc kéo ảnh vào đây"}
                    </strong>
                    <span>JPG, PNG, WebP, GIF · tối đa 5 MB</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <form className="chat-composer" onSubmit={onSubmit}>
            {referenceAsset ? (
              <div className="reference-asset-chip">
                <img src={referenceAsset.url} alt="" />
                <span>Ảnh tham chiếu</span>
                <button
                  type="button"
                  aria-label="Bỏ ảnh tham chiếu"
                  title="Bỏ ảnh tham chiếu"
                  onClick={() => setReferenceAsset(null)}
                >
                  ×
                </button>
              </div>
            ) : null}
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
                  if (input.trim() || referenceAsset) void sendPrompt(input);
                }
              }}
              placeholder={
                referenceAsset
                  ? "Mô tả thêm (tùy chọn)…"
                  : "Mô tả landing page hoặc yêu cầu chỉnh sửa…"
              }
              rows={3}
            />
            <div>
              <span>Enter để gửi · Shift + Enter xuống dòng</span>
              <button
                type="submit"
                disabled={(!input.trim() && !referenceAsset) || isGenerating}
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
            <button
              className="version-pill"
              type="button"
              onClick={() => setVersionHistoryOpen(true)}
              disabled={!user || !projectId}
              aria-label="Mở lịch sử phiên bản"
            >
              <span>
                {previewVersion
                  ? `Đang xem phiên bản ${previewVersion.versionNumber}`
                  : `Phiên bản ${version}`}
              </span>
              <i />
            </button>
          </div>

          <div className="preview-stage">
            {editorReady && !previewVersion ? (
              <div className="editor-sidebar">
                <SectionNavigator
                  sectionOrder={landing.sectionOrder}
                  selectedSection={selectedSection}
                  onSelect={selectSection}
                  onReorder={reorderSections}
                  onToggleVisibility={toggleSectionVisibility}
                  onAddSection={addSection}
                  hiddenSections={landing.hiddenSections}
                  isBusy={isGenerating}
                />
                <SectionColorPanel
                  landing={landing}
                  selectedSection={selectedSection}
                  isBusy={isGenerating}
                  onSetColor={setSectionColor}
                  onResetColors={resetSectionColors}
                  onToggleVisibility={toggleSectionVisibility}
                />
              </div>
            ) : (
              <div className="editor-sidebar">
                <aside
                  className="section-navigator is-loading"
                  aria-label="Đang mở trình bố cục"
                />
              </div>
            )}
            <div className={previewClass}>
              <div className="browser-bar">
                <div><i /><i /><i /></div>
                <p><span>⌕</span> {projectSlug || "ban-nhap"}.lumo.site</p>
                <span aria-hidden="true">↻</span>
              </div>
              <div className="preview-scroll" ref={previewScroll}>
                {previewVersion ? (
                  <div className="version-preview-banner" role="status">
                    <span>
                      Đang xem phiên bản {previewVersion.versionNumber}. Đây là
                      bản xem trước chỉ đọc.
                    </span>
                    <button type="button" onClick={() => setPreviewVersion(null)}>
                      Quay lại bản hiện tại
                    </button>
                  </div>
                ) : null}
                {editorReady ? (
                  <LandingCanvas
                  data={previewLanding}
                  compact
                  slug={projectSlug}
                  mode={previewVersion ? "public" : "editor"}
                  selectedSection={previewVersion ? null : selectedSection}
                  onSelectSection={previewVersion ? undefined : selectSection}
                  sectionOrder={previewLanding.sectionOrder.filter(
                    (section) => !previewLanding.hiddenSections.includes(section)
                  )}
                  onReorderSections={previewVersion ? undefined : reorderSections}
                  onDropImage={previewVersion ? undefined : (target, payload) => {
                    if (payload.files?.length) {
                      void uploadImages(payload.files, target);
                    } else if (
                      payload.asset &&
                      payload.source &&
                      reorderGalleryImage(payload.source, target)
                    ) {
                      return;
                    } else if (payload.asset) {
                      placeUploadedImages([payload.asset], target);
                    }
                  }}
                  onRemoveImage={previewVersion ? undefined : removePlacedImage}
                  onEditText={previewVersion ? undefined : editLandingText}
                  onPositionChange={
                    previewVersion ? undefined : handleImagePositionChange
                  }
                  isBusy={isGenerating}
                  />
                ) : (
                  <div className="preview-loading" role="status">
                    <span aria-hidden="true" />
                    <p>Đang tải dự án…</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <footer className="preview-footer">
            <span><i /> Bản xem trước trực tiếp</span>
            <span>{user ? "Thay đổi được lưu tự động" : "Đăng nhập để lưu và xuất bản"}</span>
          </footer>
        </section>
      </div>

      <PublishSettingsDialog
        open={publishDialogOpen}
        landing={landing}
        slug={draftPublishSlug}
        settings={publishSettings}
        assets={uploadedAssets}
        isPublishing={isPublishing}
        onClose={() => setPublishDialogOpen(false)}
        onSlugChange={(value) =>
          setDraftPublishSlug(
            value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80)
          )
        }
        onSettingsChange={(patch) =>
          setPublishSettings((current) => ({ ...current, ...patch }))
        }
        onPublish={() => void publish()}
      />

      <VersionHistoryPanel
        open={versionHistoryOpen}
        projectId={projectId}
        onClose={() => setVersionHistoryOpen(false)}
        onPreview={setPreviewVersion}
        onRestored={applyRestoredVersion}
      />

      <NewProjectDialog
        key={`${templateDialogMode}-${newProjectDialogOpen ? "open" : "closed"}`}
        open={newProjectDialogOpen}
        mode={templateDialogMode}
        busy={isGenerating}
        onClose={() => setNewProjectDialogOpen(false)}
        onCreateWithAi={createProjectWithAi}
        onChooseTemplate={chooseTemplate}
        onCreateBlank={createBlankProject}
      />
    </main>
  );
}
