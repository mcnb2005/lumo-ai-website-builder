import { getRuntimeEnv } from "../../../db";
import { defaultLanding, type LandingData } from "../../landing-data";

const requiredKeys: Array<keyof LandingData> = [
  "brand",
  "navCta",
  "eyebrow",
  "headline",
  "accentLine",
  "description",
  "primaryCta",
  "secondaryCta",
  "proof",
  "stats",
  "features",
  "testimonial",
  "palette",
];

function isLandingData(value: unknown): value is LandingData {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return requiredKeys.every((key) => key in record);
}

function parseJsonObject(text: string) {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI trả về dữ liệu không hợp lệ.");
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

function applyDemoPrompt(prompt: string, current: LandingData): LandingData {
  const next = structuredClone(current);
  const normalized = prompt.toLocaleLowerCase("vi");

  if (normalized.includes("cà phê") || normalized.includes("coffee")) {
    return {
      ...defaultLanding,
      brand: "Nếp Coffee",
      navCta: "Đặt bàn",
      eyebrow: "Cà phê Việt, nhịp sống mới",
      headline: "Một khoảng dừng",
      accentLine: "đậm vị Việt.",
      description:
        "Nếp rang cà phê theo từng mẻ nhỏ, phục vụ trong không gian ấm áp dành cho những cuộc gặp thật lòng.",
      primaryCta: "Khám phá thực đơn",
      secondaryCta: "Câu chuyện của Nếp",
      proof: "4.9/5 từ hơn 1.200 người yêu cà phê",
      stats: [
        { value: "100%", label: "Hạt cà phê truy xuất nguồn gốc" },
        { value: "24h", label: "Rang mới trước khi phục vụ" },
        { value: "6", label: "Vùng nguyên liệu Việt Nam" },
      ],
      features: [
        {
          number: "01",
          title: "Hạt Việt chọn lọc",
          text: "Arabica Cầu Đất và Robusta Buôn Ma Thuột được tuyển theo mùa.",
        },
        {
          number: "02",
          title: "Rang vừa đủ",
          text: "Mỗi profile rang giữ lại vị ngọt tự nhiên và hậu vị riêng.",
        },
        {
          number: "03",
          title: "Không gian có nhịp",
          text: "Đủ yên để tập trung, đủ ấm để những câu chuyện bắt đầu.",
        },
      ],
      testimonial: {
        quote:
          "Nếp là nơi tôi tìm thấy một ly cà phê chỉn chu và khoảng thời gian chậm lại giữa thành phố.",
        name: "Hà My",
        role: "Khách quen từ 2023",
      },
      palette: {
        ink: "#2b1c16",
        paper: "#f4eadc",
        accent: "#bf4b2f",
        soft: "#dcc7a8",
        line: "#cbbda9",
      },
    };
  }

  if (normalized.includes("spa") || normalized.includes("làm đẹp")) {
    next.brand = "An Nhiên";
    next.eyebrow = "Chăm sóc sâu, đẹp tự nhiên";
    next.headline = "Trở về với";
    next.accentLine = "phiên bản rạng rỡ.";
    next.description =
      "Liệu trình cá nhân hóa kết hợp công nghệ lành tính và nhịp chăm sóc tinh tế cho làn da Việt.";
    next.primaryCta = "Đặt lịch soi da";
    next.palette = {
      ink: "#25372f",
      paper: "#f5f1eb",
      accent: "#a56f5d",
      soft: "#dce6dd",
      line: "#c8ccc5",
    };
  }

  if (normalized.includes("khóa học") || normalized.includes("course")) {
    next.brand = "Bước Nhảy";
    next.eyebrow = "Khóa học thực chiến cho người đi làm";
    next.headline = "Học đúng thứ.";
    next.accentLine = "Làm được ngay.";
    next.description =
      "Lộ trình ngắn gọn, dự án thật và mentor đồng hành giúp bạn biến kiến thức thành năng lực có thể chứng minh.";
    next.primaryCta = "Nhận lộ trình học";
    next.palette = {
      ink: "#17203a",
      paper: "#f6f4ec",
      accent: "#ff5c35",
      soft: "#dfe8ff",
      line: "#c9cbd2",
    };
  }

  if (normalized.includes("tím") || normalized.includes("purple")) {
    next.palette = {
      ink: "#201735",
      paper: "#f7f3ff",
      accent: "#7c3aed",
      soft: "#e7ddff",
      line: "#d5cce7",
    };
  } else if (normalized.includes("xanh dương")) {
    next.palette = {
      ink: "#10233f",
      paper: "#f2f7fb",
      accent: "#1677ff",
      soft: "#dceaff",
      line: "#c7d4e3",
    };
  } else if (normalized.includes("màu cam")) {
    next.palette.accent = "#f05a28";
  }

  if (
    normalized.includes("tiêu đề") ||
    normalized.includes("headline") ||
    normalized.includes("ngắn")
  ) {
    next.headline = "Ý tưởng lớn.";
    next.accentLine = "Ra mắt nhanh.";
    next.description =
      "Một không gian rõ ràng để đội ngũ biến kế hoạch thành kết quả.";
  }

  if (normalized.includes("cta") || normalized.includes("kêu gọi")) {
    next.primaryCta = "Dùng thử ngay";
    next.navCta = "Bắt đầu miễn phí";
  }

  return next;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      prompt?: string;
      current?: LandingData;
    };
    const prompt = payload.prompt?.trim();
    const current = isLandingData(payload.current)
      ? payload.current
      : defaultLanding;

    if (!prompt) {
      return Response.json({ error: "Hãy nhập yêu cầu chỉnh sửa." }, { status: 400 });
    }

    const runtime = getRuntimeEnv();
    const apiKey = runtime.AI_API_KEY || runtime.OPENAI_API_KEY;
    const providerUrl = (
      runtime.AI_PROVIDER_URL || "https://api.openai.com/v1"
    ).replace(/\/+$/, "");
    const modelName =
      runtime.AI_MODEL_NAME || runtime.OPENAI_MODEL || "gpt-5.6-terra";

    if (!apiKey) {
      return Response.json({
        landing: applyDemoPrompt(prompt, current),
        message:
          "Mình đã áp dụng yêu cầu vào bản thiết kế. Bạn có thể tiếp tục mô tả ngành, màu sắc, tiêu đề hoặc CTA muốn thay đổi.",
        mode: "demo",
      });
    }

    const systemPrompt =
      "Bạn là chuyên gia conversion copywriting và thiết kế landing page. Cập nhật toàn bộ JSON landing page theo yêu cầu bằng tiếng Việt tự nhiên. Giữ đúng cấu trúc, đủ số lượng 3 stats và 3 features. Màu phải là mã hex hợp lệ. Không thêm khóa mới. Chỉ trả về một JSON object hợp lệ, không markdown, không giải thích.";

    const apiResponse = await fetch(`${providerUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Yêu cầu của người dùng:\n${prompt}\n\nLanding page hiện tại:\n${JSON.stringify(current)}`,
          },
        ],
      }),
    });

    if (!apiResponse.ok) {
      const detail = await apiResponse.text();
      throw new Error(
        `Nhà cung cấp AI trả về lỗi ${apiResponse.status}: ${detail.slice(0, 180)}`
      );
    }

    const apiPayload = (await apiResponse.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
      }>;
    };
    const outputText = apiPayload.choices?.[0]?.message?.content || "";
    const generated = parseJsonObject(outputText);
    if (!isLandingData(generated)) {
      throw new Error("AI chưa trả về đủ nội dung landing page.");
    }

    return Response.json({
      landing: generated,
      message:
        "Mình đã viết lại nội dung và cập nhật thiết kế theo yêu cầu. Hãy tiếp tục nhắn nếu bạn muốn tinh chỉnh.",
      mode: "ai",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể xử lý yêu cầu AI.",
      },
      { status: 500 }
    );
  }
}
