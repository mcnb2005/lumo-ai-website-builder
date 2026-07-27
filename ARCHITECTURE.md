# Kiến trúc Lumo AI Website Builder

## Luồng chính

```text
Studio / Landing page / Dashboard
                |
                v
           Next.js API
                |
                v
      Website Builder Agent
        |       |        |
        v       v        v
      Skill   AI Tool  Business workflow
        |       |        |
        v       v        v
     JSON UI  AI API   D1 / R2 / Google
```

## Trách nhiệm từng lớp

- `app/Studio.tsx`: giao diện chat, preview, lưu và xuất bản.
- `app/api/*`: xác thực request, giới hạn sử dụng và trả response HTTP.
- `app/server/agents/*`: điều phối một mục tiêu của người dùng.
- `app/server/skills/*`: hướng dẫn chuyên môn, quy tắc dữ liệu và kiểm tra kết quả.
- `app/server/tools/*`: một hành động kỹ thuật cụ thể, ví dụ gọi model AI.
- `app/server/google-workflow.ts`: workflow nghiệp vụ tùy chọn cho Gmail và Calendar.
- `db/*`: dữ liệu D1; ảnh được lưu qua R2.

## Agent, Skill và MCP trong project

### Agent

`website-builder-agent.ts` nhận mục tiêu, chọn skill tạo landing page, gọi AI tool,
kiểm tra kết quả rồi trả dữ liệu cho API. API không còn phải biết chi tiết prompt
hoặc định dạng phản hồi của nhà cung cấp.

### Skill

`landing-builder-skill.ts` là kỹ năng runtime của sản phẩm. Nó chứa quy tắc viết
landing page và bộ kiểm tra JSON. Có thể thêm skill mới theo cùng cấu trúc, ví dụ:

- `sales-landing-skill.ts`
- `course-registration-skill.ts`
- `event-registration-skill.ts`
- `appointment-booking-skill.ts`

### MCP

MCP chỉ nên dùng cho hệ thống bên ngoài cần cấp quyền, như Gmail, Google Calendar,
Notion hoặc CRM. Không đặt khóa hay token ở frontend. Trong bản hiện tại, Gmail và
Calendar vẫn dùng adapter máy chủ trong `google-workflow.ts`. Khi có MCP server,
thay adapter này bằng MCP client nhưng giữ nguyên Agent và API.

## Nguyên tắc mở rộng

1. Mỗi Agent giải quyết một mục tiêu rõ ràng.
2. Mỗi Skill chứa kiến thức và quy tắc, không tự ghi dữ liệu.
3. Mỗi Tool chỉ thực hiện một hành động có kiểm soát.
4. Thao tác bên ngoài phải chạy phía máy chủ và kiểm tra quyền.
5. Các hành động quan trọng cần lưu trạng thái trước khi gọi dịch vụ bên ngoài.

