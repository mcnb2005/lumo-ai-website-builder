export type DashboardType =
  | "auto"
  | "leads"
  | "orders"
  | "services"
  | "courses"
  | "events"
  | "downloads"
  | "campaigns"
  | "launches"
  | "profiles";

export type ResolvedDashboardType = Exclude<DashboardType, "auto">;

export type WorkflowStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "won"
  | "lost";

export type DashboardConfig = {
  label: string;
  centerLabel: string;
  title: string;
  navLabel: string;
  recordSingular: string;
  recordPlural: string;
  actorLabel: string;
  needLabel: string;
  detailLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  csvPrefix: string;
  metrics: {
    total: string;
    totalHint: string;
    fresh: string;
    freshHint: string;
    active: string;
    activeHint: string;
    won: string;
    wonHint: string;
  };
  statuses: Record<WorkflowStatus, string>;
};

export const dashboardTypeOptions: Array<{
  value: DashboardType;
  label: string;
}> = [
  { value: "auto", label: "Tự động nhận diện" },
  { value: "orders", label: "Bán sản phẩm / Đơn hàng" },
  { value: "services", label: "Dịch vụ / Yêu cầu tư vấn" },
  { value: "leads", label: "Thu thập khách hàng" },
  { value: "courses", label: "Khóa học / Học viên" },
  { value: "events", label: "Sự kiện / Người tham dự" },
  { value: "downloads", label: "Tải tài liệu" },
  { value: "campaigns", label: "Quảng cáo / Khuyến mãi" },
  { value: "launches", label: "Ra mắt / Danh sách chờ" },
  { value: "profiles", label: "Giới thiệu / Portfolio" },
];

const sharedStatusKeys: WorkflowStatus[] = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

function statuses(labels: string[]): Record<WorkflowStatus, string> {
  return Object.fromEntries(
    sharedStatusKeys.map((key, index) => [key, labels[index]])
  ) as Record<WorkflowStatus, string>;
}

export const dashboardConfigs: Record<
  ResolvedDashboardType,
  DashboardConfig
> = {
  leads: {
    label: "Thu thập khách hàng",
    centerLabel: "Trung tâm khách hàng",
    title: "Quản lý khách hàng",
    navLabel: "Khách hàng",
    recordSingular: "khách hàng",
    recordPlural: "khách hàng",
    actorLabel: "Khách hàng",
    needLabel: "Nhu cầu",
    detailLabel: "Chi tiết khách hàng",
    notesLabel: "Ghi chú chăm sóc",
    notesPlaceholder: "Ví dụ: Đã gọi lúc 10:30, khách quan tâm gói cao cấp…",
    searchPlaceholder: "Tìm tên, số điện thoại, email…",
    emptyTitle: "Chưa có khách hàng",
    emptyDescription:
      "Thông tin từ form trên trang đã xuất bản sẽ xuất hiện tại đây.",
    csvPrefix: "khach-hang",
    metrics: {
      total: "Tổng khách hàng",
      totalHint: "Tất cả liên hệ đã nhận",
      fresh: "Khách mới",
      freshHint: "Đang chờ xử lý",
      active: "Đang chăm sóc",
      activeHint: "Đã liên hệ hoặc tiềm năng",
      won: "Đã chốt",
      wonHint: "Khách hàng thành công",
    },
    statuses: statuses([
      "Mới",
      "Đã liên hệ",
      "Tiềm năng",
      "Đã chốt",
      "Không phù hợp",
    ]),
  },
  orders: {
    label: "Bán sản phẩm",
    centerLabel: "Trung tâm bán hàng",
    title: "Quản lý đơn hàng",
    navLabel: "Đơn hàng",
    recordSingular: "đơn hàng",
    recordPlural: "đơn hàng",
    actorLabel: "Người mua",
    needLabel: "Sản phẩm / yêu cầu",
    detailLabel: "Chi tiết đơn hàng",
    notesLabel: "Ghi chú đơn hàng",
    notesPlaceholder: "Ví dụ: Khách chọn màu đen, giao giờ hành chính…",
    searchPlaceholder: "Tìm người mua, điện thoại, sản phẩm…",
    emptyTitle: "Chưa có đơn hàng",
    emptyDescription:
      "Đơn hàng hoặc yêu cầu mua từ landing page sẽ xuất hiện tại đây.",
    csvPrefix: "don-hang",
    metrics: {
      total: "Tổng đơn hàng",
      totalHint: "Tất cả đơn đã nhận",
      fresh: "Đơn mới",
      freshHint: "Đang chờ xác nhận",
      active: "Đang xử lý",
      activeHint: "Đã xác nhận hoặc đang chuẩn bị",
      won: "Hoàn thành",
      wonHint: "Đơn hàng thành công",
    },
    statuses: statuses([
      "Đơn mới",
      "Đã xác nhận",
      "Đang xử lý",
      "Hoàn thành",
      "Đã hủy",
    ]),
  },
  services: {
    label: "Giới thiệu dịch vụ",
    centerLabel: "Trung tâm dịch vụ",
    title: "Quản lý yêu cầu dịch vụ",
    navLabel: "Yêu cầu",
    recordSingular: "yêu cầu",
    recordPlural: "yêu cầu dịch vụ",
    actorLabel: "Khách yêu cầu",
    needLabel: "Dịch vụ quan tâm",
    detailLabel: "Chi tiết yêu cầu",
    notesLabel: "Ghi chú tư vấn",
    notesPlaceholder: "Ví dụ: Đã gửi báo giá, hẹn gọi lại vào thứ Hai…",
    searchPlaceholder: "Tìm khách, dịch vụ, số điện thoại…",
    emptyTitle: "Chưa có yêu cầu dịch vụ",
    emptyDescription:
      "Yêu cầu tư vấn, báo giá hoặc liên hệ sẽ xuất hiện tại đây.",
    csvPrefix: "yeu-cau-dich-vu",
    metrics: {
      total: "Tổng yêu cầu",
      totalHint: "Tất cả yêu cầu đã nhận",
      fresh: "Yêu cầu mới",
      freshHint: "Đang chờ phản hồi",
      active: "Đang tư vấn",
      activeHint: "Đã liên hệ hoặc gửi báo giá",
      won: "Đã ký",
      wonHint: "Yêu cầu đã chuyển đổi",
    },
    statuses: statuses([
      "Mới",
      "Đã liên hệ",
      "Đã gửi báo giá",
      "Đã ký",
      "Không phù hợp",
    ]),
  },
  courses: {
    label: "Quảng bá khóa học",
    centerLabel: "Trung tâm đào tạo",
    title: "Quản lý đăng ký khóa học",
    navLabel: "Học viên",
    recordSingular: "đăng ký",
    recordPlural: "đăng ký khóa học",
    actorLabel: "Học viên",
    needLabel: "Khóa học quan tâm",
    detailLabel: "Chi tiết đăng ký",
    notesLabel: "Ghi chú tuyển sinh",
    notesPlaceholder: "Ví dụ: Học viên muốn học ca tối, đã gửi học phí…",
    searchPlaceholder: "Tìm học viên, khóa học, điện thoại…",
    emptyTitle: "Chưa có học viên đăng ký",
    emptyDescription:
      "Thông tin đăng ký khóa học sẽ xuất hiện tại đây.",
    csvPrefix: "dang-ky-khoa-hoc",
    metrics: {
      total: "Tổng đăng ký",
      totalHint: "Tất cả lượt đăng ký",
      fresh: "Đăng ký mới",
      freshHint: "Đang chờ tư vấn",
      active: "Đang tuyển sinh",
      activeHint: "Đã liên hệ hoặc giữ chỗ",
      won: "Đã nhập học",
      wonHint: "Học viên đã hoàn tất",
    },
    statuses: statuses([
      "Đăng ký mới",
      "Đã tư vấn",
      "Đã giữ chỗ",
      "Đã nhập học",
      "Đã hủy",
    ]),
  },
  events: {
    label: "Quảng bá sự kiện",
    centerLabel: "Trung tâm sự kiện",
    title: "Quản lý người tham dự",
    navLabel: "Người tham dự",
    recordSingular: "đăng ký",
    recordPlural: "người đăng ký tham dự",
    actorLabel: "Người đăng ký",
    needLabel: "Nội dung quan tâm",
    detailLabel: "Chi tiết người tham dự",
    notesLabel: "Ghi chú sự kiện",
    notesPlaceholder: "Ví dụ: Đã gửi vé, khách cần chỗ ngồi gần sân khấu…",
    searchPlaceholder: "Tìm người tham dự, email, điện thoại…",
    emptyTitle: "Chưa có người đăng ký",
    emptyDescription:
      "Đăng ký hội thảo, workshop hoặc webinar sẽ xuất hiện tại đây.",
    csvPrefix: "nguoi-tham-du",
    metrics: {
      total: "Tổng đăng ký",
      totalHint: "Tất cả người đăng ký",
      fresh: "Đăng ký mới",
      freshHint: "Đang chờ xác nhận",
      active: "Đã xác nhận",
      activeHint: "Đã gửi vé hoặc nhắc lịch",
      won: "Đã tham dự",
      wonHint: "Người đã check-in",
    },
    statuses: statuses([
      "Đăng ký mới",
      "Đã xác nhận",
      "Đã gửi vé",
      "Đã tham dự",
      "Đã hủy",
    ]),
  },
  downloads: {
    label: "Tải tài liệu",
    centerLabel: "Trung tâm nội dung",
    title: "Quản lý lượt nhận tài liệu",
    navLabel: "Lượt tải",
    recordSingular: "lượt đăng ký",
    recordPlural: "lượt nhận tài liệu",
    actorLabel: "Người nhận",
    needLabel: "Tài liệu quan tâm",
    detailLabel: "Chi tiết lượt nhận",
    notesLabel: "Ghi chú tiếp thị",
    notesPlaceholder: "Ví dụ: Đã gửi ebook, thêm vào chuỗi email chăm sóc…",
    searchPlaceholder: "Tìm email, người nhận, tài liệu…",
    emptyTitle: "Chưa có lượt nhận tài liệu",
    emptyDescription:
      "Người để lại thông tin để tải tài liệu sẽ xuất hiện tại đây.",
    csvPrefix: "luot-tai-tai-lieu",
    metrics: {
      total: "Tổng lượt đăng ký",
      totalHint: "Tất cả yêu cầu tài liệu",
      fresh: "Yêu cầu mới",
      freshHint: "Đang chờ gửi tài liệu",
      active: "Đã gửi",
      activeHint: "Đã gửi email hoặc liên kết",
      won: "Đã tải",
      wonHint: "Người dùng đã nhận tài liệu",
    },
    statuses: statuses([
      "Yêu cầu mới",
      "Đã gửi",
      "Đã mở",
      "Đã tải",
      "Không hợp lệ",
    ]),
  },
  campaigns: {
    label: "Quảng cáo / Khuyến mãi",
    centerLabel: "Trung tâm chiến dịch",
    title: "Theo dõi chuyển đổi",
    navLabel: "Chuyển đổi",
    recordSingular: "chuyển đổi",
    recordPlural: "lượt chuyển đổi",
    actorLabel: "Người chuyển đổi",
    needLabel: "Ưu đãi quan tâm",
    detailLabel: "Chi tiết chuyển đổi",
    notesLabel: "Ghi chú chiến dịch",
    notesPlaceholder: "Ví dụ: Đến từ Facebook Ads, quan tâm ưu đãi 30%…",
    searchPlaceholder: "Tìm người dùng, chiến dịch, ưu đãi…",
    emptyTitle: "Chưa có chuyển đổi",
    emptyDescription:
      "Thông tin thu được từ chiến dịch quảng cáo hoặc khuyến mãi sẽ xuất hiện tại đây.",
    csvPrefix: "chuyen-doi-chien-dich",
    metrics: {
      total: "Tổng chuyển đổi",
      totalHint: "Tất cả hành động đã nhận",
      fresh: "Chuyển đổi mới",
      freshHint: "Đang chờ xử lý",
      active: "Đang nuôi dưỡng",
      activeHint: "Đã liên hệ hoặc phân loại",
      won: "Đã mua",
      wonHint: "Chuyển đổi thành doanh thu",
    },
    statuses: statuses([
      "Mới",
      "Đã tiếp cận",
      "Đang quan tâm",
      "Đã mua",
      "Không chuyển đổi",
    ]),
  },
  launches: {
    label: "Ra mắt sản phẩm",
    centerLabel: "Trung tâm ra mắt",
    title: "Quản lý danh sách quan tâm",
    navLabel: "Danh sách chờ",
    recordSingular: "người quan tâm",
    recordPlural: "người trong danh sách chờ",
    actorLabel: "Người quan tâm",
    needLabel: "Sản phẩm quan tâm",
    detailLabel: "Chi tiết người quan tâm",
    notesLabel: "Ghi chú ra mắt",
    notesPlaceholder: "Ví dụ: Đã gửi thông báo sớm, khách muốn đặt trước…",
    searchPlaceholder: "Tìm người quan tâm, email, sản phẩm…",
    emptyTitle: "Chưa có người đăng ký sớm",
    emptyDescription:
      "Danh sách nhận thông báo hoặc đăng ký mua trước sẽ xuất hiện tại đây.",
    csvPrefix: "danh-sach-cho",
    metrics: {
      total: "Tổng quan tâm",
      totalHint: "Tất cả người đăng ký sớm",
      fresh: "Đăng ký mới",
      freshHint: "Đang chờ xác nhận",
      active: "Đã thông báo",
      activeHint: "Đã gửi cập nhật ra mắt",
      won: "Đã đặt trước",
      wonHint: "Người đã chuyển thành đơn",
    },
    statuses: statuses([
      "Mới",
      "Đã xác nhận",
      "Đã thông báo",
      "Đã đặt trước",
      "Đã hủy",
    ]),
  },
  profiles: {
    label: "Giới thiệu / Portfolio",
    centerLabel: "Trung tâm liên hệ",
    title: "Quản lý yêu cầu liên hệ",
    navLabel: "Liên hệ",
    recordSingular: "liên hệ",
    recordPlural: "yêu cầu liên hệ",
    actorLabel: "Người liên hệ",
    needLabel: "Nội dung",
    detailLabel: "Chi tiết liên hệ",
    notesLabel: "Ghi chú phản hồi",
    notesPlaceholder: "Ví dụ: Đã phản hồi portfolio, hẹn trao đổi dự án…",
    searchPlaceholder: "Tìm người liên hệ, công ty, nội dung…",
    emptyTitle: "Chưa có liên hệ",
    emptyDescription:
      "Yêu cầu từ trang giới thiệu doanh nghiệp, cá nhân hoặc portfolio sẽ xuất hiện tại đây.",
    csvPrefix: "lien-he",
    metrics: {
      total: "Tổng liên hệ",
      totalHint: "Tất cả yêu cầu đã nhận",
      fresh: "Liên hệ mới",
      freshHint: "Đang chờ phản hồi",
      active: "Đang trao đổi",
      activeHint: "Đã phản hồi hoặc hẹn gặp",
      won: "Đã hợp tác",
      wonHint: "Liên hệ đã chuyển đổi",
    },
    statuses: statuses([
      "Mới",
      "Đã phản hồi",
      "Đang trao đổi",
      "Đã hợp tác",
      "Đã đóng",
    ]),
  },
};

export function isDashboardType(value: unknown): value is DashboardType {
  return dashboardTypeOptions.some((option) => option.value === value);
}

export function inferDashboardType(value: unknown): ResolvedDashboardType {
  const source =
    typeof value === "string" ? value : JSON.stringify(value || {});
  const text = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi");

  const includesAny = (patterns: string[]) =>
    patterns.some((pattern) => text.includes(pattern));

  if (
    includesAny([
      "hoi thao",
      "workshop",
      "webinar",
      "cuoc thi",
      "khai truong",
      "hoi nghi",
      "dien gia",
    ])
  ) {
    return "events";
  }
  if (
    includesAny([
      "khoa hoc",
      "hoc vien",
      "hoc phi",
      "giang vien",
      "chuong trinh hoc",
    ])
  ) {
    return "courses";
  }
  if (
    includesAny([
      "tai tai lieu",
      "tai ebook",
      "ebook",
      "tai mien phi",
      "download",
    ])
  ) {
    return "downloads";
  }
  if (
    includesAny([
      "ra mat",
      "dang ky som",
      "ban truoc",
      "dat truoc",
      "dem nguoc",
      "nhan thong bao",
    ])
  ) {
    return "launches";
  }
  if (
    includesAny([
      "quang cao",
      "facebook ads",
      "google ads",
      "tiktok ads",
      "khuyen mai",
      "giam 30%",
      "mua 1 tang 1",
      "uu dai cuoi nam",
    ])
  ) {
    return "campaigns";
  }
  if (
    includesAny([
      "mua ngay",
      "dat hang",
      "gia ban",
      "ban san pham",
      "them vao gio",
      "thanh toan",
    ])
  ) {
    return "orders";
  }
  if (
    includesAny([
      "dich vu",
      "nhan bao gia",
      "quy trinh lam viec",
      "phong kham",
      "sua chua",
      "ke toan",
    ])
  ) {
    return "services";
  }
  if (
    includesAny([
      "portfolio",
      "freelancer",
      "ho so chuyen gia",
      "gioi thieu cong ty",
      "gioi thieu ca nhan",
      "toi la ai",
    ])
  ) {
    return "profiles";
  }
  return "leads";
}
