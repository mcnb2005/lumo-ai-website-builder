export type LandingData = {
  brand: string;
  navCta: string;
  eyebrow: string;
  headline: string;
  accentLine: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  proof: string;
  stats: Array<{ value: string; label: string }>;
  features: Array<{ number: string; title: string; text: string }>;
  testimonial: { quote: string; name: string; role: string };
  palette: {
    ink: string;
    paper: string;
    accent: string;
    soft: string;
    line: string;
  };
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export const defaultLanding: LandingData = {
  brand: "Morrow",
  navCta: "Đặt lịch demo",
  eyebrow: "Hệ điều hành cho đội ngũ sáng tạo",
  headline: "Từ ý tưởng đến",
  accentLine: "tăng trưởng thật.",
  description:
    "Morrow gom dự án, phản hồi và hiệu suất vào một không gian làm việc rõ ràng — để đội ngũ tập trung tạo ra những điều đáng nhớ.",
  primaryCta: "Bắt đầu miễn phí",
  secondaryCta: "Xem cách hoạt động",
  proof: "Được tin dùng bởi 2.000+ đội ngũ hiện đại",
  stats: [
    { value: "3.4×", label: "Nhanh hơn từ brief đến launch" },
    { value: "42%", label: "Ít vòng phản hồi hơn" },
    { value: "18h", label: "Tiết kiệm mỗi tuần" },
  ],
  features: [
    {
      number: "01",
      title: "Một nơi cho mọi ý tưởng",
      text: "Biến brief, tài liệu và phản hồi rời rạc thành một nguồn thông tin chung.",
    },
    {
      number: "02",
      title: "Nhịp làm việc tự động",
      text: "Giữ mọi người đúng tiến độ với quy trình linh hoạt và nhắc việc thông minh.",
    },
    {
      number: "03",
      title: "Hiệu quả nhìn thấy được",
      text: "Đo thời gian, chất lượng và tác động mà không cần thêm bảng tính.",
    },
  ],
  testimonial: {
    quote:
      "Morrow giúp đội ngũ của chúng tôi ra mắt chiến dịch trong vài ngày thay vì vài tuần.",
    name: "Minh Anh",
    role: "Creative Director, Folklore",
  },
  palette: {
    ink: "#15271f",
    paper: "#f6f2e8",
    accent: "#e8542f",
    soft: "#dfe9d9",
    line: "#c9c8bd",
  },
};

export const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Chào bạn, mình là Lumo. Hãy mô tả doanh nghiệp hoặc sản phẩm — mình sẽ tạo landing page và sửa trực tiếp theo từng tin nhắn.",
  },
];
