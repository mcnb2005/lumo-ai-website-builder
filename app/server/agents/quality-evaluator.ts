import type { LandingData, LandingSectionType } from "../../landing-data";
import type { BusinessBrief, LandingBlueprint } from "../../landing-project";

export type LandingQualityIssue = {
  code: string;
  message: string;
  section?: LandingSectionType;
  severity: "warning" | "error";
};

export type LandingQualityReport = {
  businessRelevance: number;
  contentCompleteness: number;
  conversionClarity: number;
  visualSafety: number;
  overall: number;
  passed: boolean;
  issues: LandingQualityIssue[];
};

const genericCopy = /biến ý tưởng thành hiện thực|điều lớn lao|giải pháp toàn diện|lorem ipsum|nội dung mẫu|tiêu đề mẫu/i;

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasUsefulSectionContent(landing: LandingData, section: LandingSectionType) {
  switch (section) {
    case "hero":
      return words(`${landing.headline} ${landing.accentLine}`).length >= 5;
    case "stats":
      return landing.stats.length >= 2 && landing.stats.every((item) => item.value && item.label);
    case "features":
      return landing.features.length >= 3 && landing.features.every((item) => item.title && item.text);
    case "pricing":
      return landing.pricing.length >= 1 && landing.pricing.every((item) => item.name && item.cta);
    case "portfolio":
      return landing.portfolio.length >= 1 && landing.portfolio.every((item) => item.title && item.description);
    case "gallery":
      return Boolean(landing.galleryHeadline.trim());
    case "testimonial":
      return words(landing.testimonial.quote).length >= 6;
    case "faq":
      return landing.faq.length >= 2 && landing.faq.every((item) => item.question && item.answer);
    case "leadForm":
      return landing.leadForm.fields.length >= 2 && Boolean(landing.leadForm.buttonText.trim());
    case "finalCta":
      return words(landing.finalCtaHeadline).length >= 3;
  }
}

function isSafeAssetUrl(url: string) {
  if (!url) return true;
  return /^(?:https?:\/\/|\/api\/assets\/|data:image\/)/i.test(url);
}

export function evaluateLandingQuality(
  landing: LandingData,
  brief: BusinessBrief,
  blueprint: LandingBlueprint
): LandingQualityReport {
  const issues: LandingQualityIssue[] = [];
  let businessRelevance = 100;
  let contentCompleteness = 100;
  let conversionClarity = 100;
  let visualSafety = 100;
  const visible = blueprint.sections.map((section) => section.type);
  const mainCopy = [
    landing.brand,
    landing.eyebrow,
    landing.headline,
    landing.accentLine,
    landing.description,
    landing.featuresHeadline,
  ].join(" ");

  if (genericCopy.test(mainCopy)) {
    businessRelevance -= 24;
    issues.push({
      code: "generic-copy",
      message: "Nội dung còn dùng câu chung chung, chưa gắn rõ với sản phẩm.",
      section: "hero",
      severity: "error",
    });
  }
  const relevanceTerms = `${brief.businessType} ${brief.product}`
    .toLocaleLowerCase("vi")
    .split(/\s+/)
    .filter((term) => term.length >= 3);
  if (
    relevanceTerms.length &&
    !relevanceTerms.some((term) => mainCopy.toLocaleLowerCase("vi").includes(term))
  ) {
    businessRelevance -= 22;
    issues.push({
      code: "business-mismatch",
      message: "Hero chưa nhắc rõ sản phẩm hoặc lĩnh vực trong brief.",
      section: "hero",
      severity: "error",
    });
  }

  blueprint.sections.forEach(({ type }) => {
    if (!hasUsefulSectionContent(landing, type)) {
      contentCompleteness -= 12;
      issues.push({
        code: `incomplete-${type}`,
        message: `Section ${type} chưa có đủ nội dung hữu ích.`,
        section: type,
        severity: "error",
      });
    }
  });
  if (visible.length < 6) {
    contentCompleteness -= 18;
    issues.push({
      code: "short-journey",
      message: "Hành trình chuyển đổi đang có quá ít section.",
      severity: "error",
    });
  }

  const headlineWords = words(`${landing.headline} ${landing.accentLine}`);
  if (headlineWords.length > 16) {
    conversionClarity -= 12;
    issues.push({
      code: "hero-headline-long",
      message: "Tiêu đề Hero dài hơn 16 từ.",
      section: "hero",
      severity: "warning",
    });
  }
  if (words(landing.description).length > 50) {
    conversionClarity -= 8;
    issues.push({
      code: "hero-description-long",
      message: "Mô tả Hero dài hơn 50 từ.",
      section: "hero",
      severity: "warning",
    });
  }
  if (!landing.primaryCta.trim() || words(landing.primaryCta).length > 5) {
    conversionClarity -= 20;
    issues.push({
      code: "unclear-cta",
      message: "CTA chính cần rõ ràng và không quá 5 từ.",
      section: "hero",
      severity: "error",
    });
  }

  const assetUrls = [
    landing.heroImage,
    ...landing.gallery.map((item) => item.url),
    ...landing.portfolio.map((item) => item.imageUrl),
  ];
  if (assetUrls.some((url) => !isSafeAssetUrl(url))) {
    visualSafety -= 35;
    issues.push({
      code: "unsafe-image-url",
      message: "Landing page chứa URL ảnh không được hỗ trợ.",
      severity: "error",
    });
  }
  if (
    landing.design?.sectionVariants.hero === "image-background" &&
    !landing.heroImage
  ) {
    visualSafety -= 15;
    issues.push({
      code: "empty-image-hero",
      message: "Hero nền ảnh chưa có ảnh và cần chuyển sang bố cục centered.",
      section: "hero",
      severity: "warning",
    });
  }

  businessRelevance = clampScore(businessRelevance);
  contentCompleteness = clampScore(contentCompleteness);
  conversionClarity = clampScore(conversionClarity);
  visualSafety = clampScore(visualSafety);
  const overall = clampScore(
    businessRelevance * 0.3 +
      contentCompleteness * 0.3 +
      conversionClarity * 0.25 +
      visualSafety * 0.15
  );

  return {
    businessRelevance,
    contentCompleteness,
    conversionClarity,
    visualSafety,
    overall,
    passed: overall >= 80 && !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
