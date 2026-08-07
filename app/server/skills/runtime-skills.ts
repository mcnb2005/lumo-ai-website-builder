export type RuntimeSkillDefinition = {
  id: string;
  version: string;
  name: string;
  description: string;
  whenToUse: string[];
  input: string[];
  output: string[];
  rules: string[];
  testCases: string[];
};

export const landingUiDesignSkill: RuntimeSkillDefinition = {
  id: "landing-ui-design",
  version: "1.0.0",
  name: "Thiết kế giao diện landing có kiểm soát",
  description:
    "Chọn cấu trúc, variant và hệ thống thị giác riêng theo mục tiêu nhưng chỉ trong LandingData và component catalog của Lumo.",
  whenToUse: [
    "Khi tạo landing mới hoặc thay đổi template, bố cục, giao diện, responsive và cấu trúc section.",
  ],
  input: [
    "Mục tiêu kinh doanh",
    "Đối tượng người dùng",
    "CTA chính",
    "Template và component catalog hiện có",
  ],
  output: [
    "BuilderPlan hoặc LandingProject hợp lệ",
    "Section order và variant đã đăng ký",
    "LandingData hoặc operations đã kiểm tra schema",
  ],
  rules: [
    "Xác định mục tiêu, đối tượng, CTA chính và một hướng thẩm mỹ rõ ràng trước khi chọn bố cục.",
    "Chỉ dùng section và variant đã đăng ký trong component catalog; không sinh HTML, CSS, JSX hoặc React tự do.",
    "Mỗi loại template phải có hành trình nội dung, thứ tự section, mật độ và điểm nhấn hình ảnh khác biệt rõ ràng.",
    "Không ép mọi landing theo cùng chuỗi Hero, Stats, Features, Pricing, Testimonial và FAQ.",
    "Dùng typography, palette và sectionColors hiện có thay vì tạo hệ design token song song.",
    "Giữ một CTA chuyển đổi chính xuyên suốt Hero, pricing, form và final CTA.",
    "Không bịa URL ảnh, không làm vỡ bố cục khi thiếu ảnh và phải giữ URL tài sản nội bộ.",
    "Bảo đảm dữ liệu có thể render an toàn trên desktop, tablet và mobile.",
    "Chỉ trả JSON đúng schema hoặc operations đã được validation; không trả code giao diện tự do.",
  ],
  testCases: [
    "Tạo landing sản phẩm có gallery và bảng giá nổi bật",
    "Tạo landing dịch vụ lấy portfolio và tư vấn làm trọng tâm",
    "Tạo landing lead generation với form ngắn ngay sau Hero",
  ],
};

export const runtimeSkills: RuntimeSkillDefinition[] = [
  landingUiDesignSkill,
  {
    id: "create-landing",
    version: "1.1.0",
    name: "Tạo landing page",
    description: "Tạo cấu trúc landing page mới từ mục tiêu kinh doanh.",
    whenToUse: ["Khi người dùng mô tả doanh nghiệp mới hoặc muốn bắt đầu từ đầu."],
    input: ["Mục tiêu kinh doanh", "Ngành nghề", "Thông tin sản phẩm", "Tùy chọn tone"] ,
    output: ["JSON landing draft", "Giải thích ngắn", "Danh sách section đề xuất"],
    rules: [
      ...landingUiDesignSkill.rules,
      "Không tự xuất bản khi chưa có xác nhận.",
      "Giữ cấu trúc JSON nhất quán.",
      "Tách rõ CTA và form để tránh nhầm lẫn.",
    ],
    testCases: ["Tạo landing cho cửa hàng thời trang", "Tạo landing cho dịch vụ tư vấn"],
  },
  {
    id: "edit-landing",
    version: "1.0.0",
    name: "Chỉnh sửa landing page",
    description: "Sửa nội dung hoặc cấu trúc section theo yêu cầu hội thoại.",
    whenToUse: ["Khi người dùng muốn đổi tiêu đề, CTA, màu sắc, nội dung hoặc section."],
    input: ["Yêu cầu người dùng", "Phiên bản landing hiện tại", "Section đang chọn"],
    output: ["Danh sách JSON Patch", "Giải thích ngắn", "Cảnh báo nếu thay đổi CTA hoặc form"],
    rules: [
      "Không đổi tên trường bắt buộc của form.",
      "Nếu thay đổi CTA hoặc form, cần nhắc lại xác nhận.",
      "Giữ nguyên URL ảnh nội bộ.",
    ],
    testCases: ["Đổi headline", "Thay đổi màu sắc và nút CTA"],
  },
  {
    id: "design-form",
    version: "1.0.0",
    name: "Thiết kế form chuyển đổi",
    description: "Thiết kế form thu thập thông tin khách hàng phù hợp với mục tiêu bán hàng.",
    whenToUse: ["Khi cần thêm hoặc chỉnh form lead/order."],
    input: ["Mục tiêu chuyển đổi", "Danh sách trường cần thu", "Loại dashboard"],
    output: ["Schema form", "Danh sách field", "Gợi ý validation"],
    rules: [
      "Không dùng AI để lưu form vào database.",
      "Luồng lưu form phải chạy bằng code cố định.",
      "Đảm bảo field thời gian giao hàng có tên nhận diện được.",
    ],
    testCases: ["Form đặt hàng sản phẩm", "Form nhận tư vấn"],
  },
  {
    id: "conversion-copywriting",
    version: "1.0.0",
    name: "Viết copy tăng chuyển đổi",
    description: "Tối ưu headline, CTA và mô tả cho landing page.",
    whenToUse: ["Khi cần cải thiện lời gọi hành động hoặc nội dung bán hàng."],
    input: ["Ngành nghề", "Đối tượng khách hàng", "Thông điệp hiện tại"],
    output: ["Copy đề xuất", "Version mới", "Cảnh báo về độ dài"],
    rules: [
      "Không tự ý thay đổi giá cả nếu chưa được xác nhận.",
      "Giữ văn phong tự nhiên và rõ lợi ích.",
    ],
    testCases: ["Viết lại headline cho dịch vụ", "Rà soát CTA"],
  },
  {
    id: "seo-audit",
    version: "1.0.0",
    name: "SEO audit",
    description: "Đánh giá cơ bản về cấu trúc tiêu đề, heading và nội dung SEO.",
    whenToUse: ["Khi cần kiểm tra khả năng hiển thị tìm kiếm."],
    input: ["Landing page hiện tại", "Từ khóa mục tiêu"],
    output: ["Danh sách vấn đề", "Đề xuất sửa"],
    rules: ["Không thay đổi nội dung mà không giải thích rõ lý do."],
    testCases: ["Kiểm tra hero section", "Đề xuất H1 và meta"],
  },
  {
    id: "accessibility-check",
    version: "1.0.0",
    name: "Accessibility check",
    description: "Kiểm tra tính dễ dùng cho người dùng và người dùng màn hình đọc.",
    whenToUse: ["Khi cần rà soát bố cục, màu sắc, nút bấm và tiêu đề."],
    input: ["Landing page hiện tại"],
    output: ["Danh sách vấn đề", "Đề xuất sửa"],
    rules: ["Đảm bảo contrast và heading logic."],  
    testCases: ["Kiểm tra CTA và nút", "Đánh giá cấu trúc heading"],
  },
  {
    id: "publish-check",
    version: "1.0.0",
    name: "Publish check",
    description: "Kiểm tra điều kiện trước khi xuất bản landing page.",
    whenToUse: ["Khi người dùng muốn xuất bản nhưng cần xác nhận trước."],
    input: ["Landing page hiện tại", "Danh sách section"],
    output: ["Checklist", "Cảnh báo", "Kết luận có thể xuất bản"],
    rules: [
      "Không tự xuất bản.",
      "Cần nhắc người dùng xác nhận trước khi publish.",
    ],
    testCases: ["Kiểm tra trước khi publish", "Kiểm tra form và CTA"],
  },
  {
    id: "summarize-submissions",
    version: "1.0.0",
    name: "Tóm tắt submissions",
    description: "Tổng hợp form submissions và gợi ý hành động tiếp theo.",
    whenToUse: ["Khi cần phân tích khách hàng đã điền form."],
    input: ["Danh sách submissions", "Mục tiêu kinh doanh"],
    output: ["Tóm tắt xu hướng", "Danh sách việc cần làm"],
    rules: ["Không tự động gửi email hoặc tạo lịch từ AI."],
    testCases: ["Tóm tắt 10 đơn trong tuần", "Phân loại lead"],
  },
  {
    id: "draft-customer-reply",
    version: "1.0.0",
    name: "Soạn phản hồi khách hàng",
    description: "Soạn email hoặc tin nhắn phản hồi cho khách hàng." ,
    whenToUse: ["Khi cần hỗ trợ phản hồi khách hàng sau khi nhận submission."],
    input: ["Nội dung lead", "Tình huống", "Tone mong muốn"],
    output: ["Draft phản hồi", "Gợi ý follow-up"],
    rules: ["Không tự gửi email mà không có xác nhận.", "Dùng ngôn ngữ chuyên nghiệp và lịch sự."],
    testCases: ["Phản hồi khách hỏi về giá", "Phản hồi sau khi nhận đơn"],
  },
];

export function resolveRuntimeSkill(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  if (normalized.includes("publish") || normalized.includes("xuất bản")) {
    return runtimeSkills.find((skill) => skill.id === "publish-check") || null;
  }
  if (normalized.includes("form") || normalized.includes("form") || normalized.includes("điền")) {
    return runtimeSkills.find((skill) => skill.id === "design-form") || null;
  }
  if (normalized.includes("seo") || normalized.includes("từ khóa")) {
    return runtimeSkills.find((skill) => skill.id === "seo-audit") || null;
  }
  if (normalized.includes("access") || normalized.includes("khả năng tiếp cận") || normalized.includes("a11y")) {
    return runtimeSkills.find((skill) => skill.id === "accessibility-check") || null;
  }
  if (normalized.includes("submission") || normalized.includes("đơn") || normalized.includes("lead")) {
    return runtimeSkills.find((skill) => skill.id === "summarize-submissions") || null;
  }
  if (normalized.includes("reply") || normalized.includes("phản hồi") || normalized.includes("email")) {
    return runtimeSkills.find((skill) => skill.id === "draft-customer-reply") || null;
  }
  if (
    normalized.includes("template") ||
    normalized.includes("layout") ||
    normalized.includes("bố cục") ||
    normalized.includes("giao diện") ||
    normalized.includes("thiết kế") ||
    normalized.includes("responsive")
  ) {
    return landingUiDesignSkill;
  }
  if (normalized.includes("chỉnh sửa") || normalized.includes("sửa") || normalized.includes("thay đổi")) {
    return runtimeSkills.find((skill) => skill.id === "edit-landing") || null;
  }
  if (normalized.includes("landing") || normalized.includes("trang") || normalized.includes("bắt đầu")) {
    return runtimeSkills.find((skill) => skill.id === "create-landing") || null;
  }
  return null;
}
