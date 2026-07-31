import { defaultLanding, type LandingData } from "../../landing-data";

export function createDemoLanding(
  prompt: string,
  current: LandingData
): LandingData {
  const next = structuredClone(current);
  const normalized = prompt.toLocaleLowerCase("vi");

  if (normalized.includes("cà phê") || normalized.includes("coffee")) {
    return {
      ...defaultLanding,
      brand: "Nếp Coffee",
      eyebrow: "Cà phê Việt, nhịp sống mới",
      headline: "Một khoảng dừng",
      accentLine: "đậm vị Việt.",
      description:
        "Cà phê rang mới trong một không gian ấm áp dành cho những cuộc gặp thật lòng.",
      primaryCta: "Khám phá thực đơn",
      navCta: "Xem thực đơn",
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
    next.primaryCta = "Nhận tư vấn soi da";
  }

  if (normalized.includes("khóa học") || normalized.includes("course")) {
    next.brand = "Bước Nhảy";
    next.eyebrow = "Khóa học thực chiến cho người đi làm";
    next.headline = "Học đúng thứ.";
    next.accentLine = "Làm được ngay.";
    next.primaryCta = "Nhận lộ trình học";
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
  }

  if (normalized.includes("cta") || normalized.includes("kêu gọi")) {
    next.primaryCta = "Dùng thử ngay";
    next.navCta = "Bắt đầu miễn phí";
  }

  return next;
}
