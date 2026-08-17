# AGENTS.md

File này là bộ quy tắc làm việc mặc định cho Codex trong repository này. Các quy tắc áp dụng cho mọi thay đổi code, cấu hình, schema, migration, dependency, test và tài liệu kỹ thuật có ảnh hưởng đến hành vi hệ thống.

# Bối cảnh project đã xác minh

## Tech stack

- Runtime yêu cầu Node.js `>=22.13.0`; project dùng ES modules (`"type": "module"`).
- Frontend và server dùng Next.js `16.2.6` App Router, React/React DOM `19.2.6` và TypeScript `5.9` ở chế độ `strict`, `noEmit`.
- Development/build chạy qua Vinext `0.0.50`, Vite `8`, Cloudflare Vite Plugin và Wrangler.
- CSS dùng Tailwind CSS `4` ở lớp import nền, đồng thời project chủ yếu dùng class semantic, CSS custom properties và media query trong `app/globals.css`.
- Kéo thả/sắp xếp dùng `@dnd-kit/core`, `@dnd-kit/sortable` và `@dnd-kit/utilities`.
- Database dùng Cloudflare D1 (SQLite) với Drizzle ORM/Drizzle Kit.
- Lưu trữ ảnh dùng Cloudflare R2 qua binding `ASSETS`; metadata ảnh được lưu trong D1.
- Test dùng Node.js built-in test runner (`node --test`) và `node:assert`.

## Cấu trúc chính

- `app/`: Next.js App Router, giao diện, shared landing renderer, editor, dashboard, company, account, login và API routes.
- `app/components/`: component dùng chung; `LandingCanvas.tsx` là renderer trung tâm cho landing page.
- `app/editor/`: navigator section, properties panel, inline editing, sortable frame và các control của editor.
- `app/templates/`: registry và UI template.
- `app/api/`: backend/API theo convention `route.ts` của Next.js.
- `app/server/agents/`: planner, content agent, pipeline tạo/chỉnh sửa landing page và quality evaluator.
- `app/server/tools/`: gọi model AI, trích xuất/kiểm tra JSON và các helper liên quan.
- `app/server/skills/`: runtime rules và validation cho pipeline.
- `db/`: Drizzle schema, D1/R2 bindings và logic khởi tạo/đồng bộ database runtime.
- `drizzle/`: các file SQL migration.
- `tests/`: test bằng Node test runner.
- `worker/`, `build/`, `vite.config.ts`, `.openai/hosting.json`: lớp chạy/build/deploy cho Cloudflare/Vinext.

## Vị trí các lớp hệ thống

- Frontend chính: `app/Studio.tsx`, `app/components/LandingCanvas.tsx`, `app/editor/`, `app/templates/`, `app/dashboard/`, `app/company/`, `app/login/`, `app/account/`.
- Trang public: `app/PublicLanding.tsx` và `app/p/[slug]/page.tsx`.
- Backend/API: `app/api/**/route.ts` và các service trong `app/server/`.
- Database/schema: `db/schema.ts`; kết nối binding và runtime DDL ở `db/index.ts`; migration ở `drizzle/*.sql`.
- AI pipeline: `app/server/agents/`, cùng các contract/operation trong `app/landing-manifest.ts`, `app/landing-operation-normalizer.ts`, `app/landing-operations.ts` và `app/landing-project.ts`.

## Lệnh hiện có

- Cài dependency: `npm install`.
- Chạy development server: `npm run dev` (thông thường tại `http://localhost:3000`).
- Chạy development server trong LAN: `npm run dev:lan`.
- Build: `npm run build`.
- Chạy bản build: `npm run start` hoặc `npm run start:lan`.
- Test: `npm test` (script hiện tại build trước rồi chạy toàn bộ danh sách test trong `tests/`).
- Lint: `npm run lint`.
- Tạo migration Drizzle: `npm run db:generate`; đây là thao tác thay đổi database artifacts, không được tự chạy khi chưa được duyệt.
- `package.json` hiện không có script `type-check` riêng. Khi cần kiểm tra type độc lập, phải báo rõ lệnh dự kiến dùng; không được tuyên bố đã chạy type-check nếu mới chỉ chạy lint hoặc test.

# 1. Quy trình bắt buộc trước khi sửa code

Khi người dùng yêu cầu sửa lỗi, thêm tính năng, refactor, thay đổi UI, API, database, kiến trúc hoặc bất kỳ thay đổi code nào, KHÔNG được sửa code ngay.

Quy trình mặc định bắt buộc:

`ANALYZE -> PLAN -> WAIT FOR APPROVAL -> IMPLEMENT -> VERIFY`

Phải thực hiện theo thứ tự:

1. Đọc và phân tích toàn bộ code liên quan.
2. Xác định nguyên nhân hoặc trạng thái hiện tại bằng bằng chứng trong repository.
3. Trình bày cho người dùng:
   - Hệ thống hiện tại đang hoạt động như thế nào.
   - Vấn đề nằm ở đâu.
   - Nguyên nhân là gì.
   - Những file dự kiến sẽ sửa.
   - Mỗi file dự kiến thay đổi gì.
   - Luồng hoạt động sau khi sửa.
   - Những phần có khả năng bị ảnh hưởng.
   - Rủi ro có thể xảy ra.
4. Đưa ra kế hoạch triển khai theo từng bước.
5. Hỏi người dùng có đồng ý triển khai hay không.
6. PHẢI DỪNG LẠI và chờ phản hồi.
7. Không được sửa file khi chưa nhận được sự đồng ý rõ ràng.

Các câu được coi là đồng ý gồm: `OK`, `Làm đi`, `Triển khai`, `Đồng ý`, `Sửa đi`, hoặc một câu khác thể hiện rõ việc chấp thuận kế hoạch vừa trình bày.

Sự đồng ý chỉ áp dụng cho phạm vi đã mô tả trong kế hoạch. Không được tự mở rộng phạm vi.

# 2. Không tự ý triển khai

Không được bỏ qua bước `WAIT FOR APPROVAL` kể cả khi:

- Thay đổi rất nhỏ.
- Lỗi có vẻ hiển nhiên.
- Chỉ sửa một dòng.
- Codex cho rằng giải pháp chắc chắn đúng.
- Đã từng sửa một vấn đề tương tự trước đó.

Chỉ được bỏ qua bước chờ duyệt nếu trong chính yêu cầu hiện tại người dùng nói rõ: `làm luôn`, `không cần hỏi`, `sửa trực tiếp`, `triển khai luôn`, hoặc một chỉ thị tương đương không mơ hồ.

# 3. Phân biệt câu hỏi với yêu cầu sửa code

Nếu người dùng hỏi những câu như:

- `là gì?`
- `nghĩa là sao?`
- `tại sao?`
- `giải thích phần này`
- `hệ thống hiện tại hoạt động như thế nào?`
- `code này làm gì?`
- `có cách nào làm không?`
- `nên làm như thế nào?`
- `hãy tìm nguyên nhân`
- `hãy kiểm tra`
- `hãy phân tích`

thì chỉ được đọc code, tìm kiếm, phân tích và giải thích. KHÔNG được tự sửa code, cấu hình, test, schema hoặc tài liệu.

Không được coi việc người dùng yêu cầu phân tích, kiểm tra, review hoặc đưa giải pháp là sự cho phép triển khai.

# 4. Khi phát hiện vấn đề mới trong lúc triển khai

Nếu trong quá trình code phát hiện cần:

- Sửa thêm file ngoài kế hoạch đã duyệt.
- Thay đổi kiến trúc.
- Thay đổi database/schema hoặc tạo migration.
- Thêm, xóa hoặc nâng cấp dependency.
- Thay đổi API contract.
- Xóa hoặc viết lại lượng code lớn.
- Thay đổi design system.
- Thay đổi authentication/authorization.
- Thay đổi cơ chế lưu trữ asset.
- Thực hiện migration hoặc thao tác dữ liệu.
- Mở rộng phạm vi lớn hơn kế hoạch đã duyệt.

thì phải:

1. Dừng triển khai phần phát sinh đó.
2. Giải thích phát hiện mới bằng bằng chứng từ code hoặc kết quả kiểm tra.
3. Nói rõ cần thay đổi thêm file/hành vi nào.
4. Giải thích lý do và ảnh hưởng.
5. Xin phép người dùng trước khi tiếp tục phần ngoài phạm vi.

# 5. Quy tắc đọc code

Trước khi sửa một chức năng:

- Tìm tất cả file liên quan.
- Tìm nơi function, component, hook, type, schema hoặc contract được định nghĩa.
- Tìm tất cả nơi quan trọng đang sử dụng nó.
- Hiểu luồng dữ liệu từ UI đến API, persistence và renderer trước khi sửa.
- Không suy đoán khi có thể kiểm tra trực tiếp trong repository.
- Không sửa triệu chứng nếu nguyên nhân thực sự nằm ở nơi khác.
- Đọc test liên quan để hiểu contract đang được bảo vệ.
- Nếu `.codegraph/` tồn tại, ưu tiên `codegraph explore` để xác định symbol và call path trước khi dùng tìm kiếm văn bản hoặc đọc file rời rạc.

Các thao tác chỉ đọc như search, CodeGraph explore, grep, đọc file, tìm references, đọc `package.json`, đọc schema và đọc test không cần xin phép.

# 6. Phạm vi thay đổi

- Chỉ sửa những gì cần thiết cho yêu cầu hiện tại và kế hoạch đã được duyệt.
- Không refactor code không liên quan.
- Không đổi tên file, function, component, type hoặc API tùy tiện.
- Không thay đổi kiến trúc chỉ vì Codex thích một cách khác.
- Không viết lại toàn bộ module nếu chỉ cần sửa nhỏ.
- Giữ backward compatibility khi có thể.
- Ưu tiên minimal diff.
- Không format hoặc tạo churn ở các file ngoài phạm vi.
- Không hoàn tác thay đổi có sẵn của người dùng.

# 7. Frontend

- Tái sử dụng component, variant, registry, CSS token và interaction hiện có khi phù hợp.
- Không tạo component trùng chức năng hoặc một renderer landing page song song với `LandingCanvas`.
- Không hard-code style tùy tiện nếu đã có design token, CSS custom property hoặc class semantic tương ứng.
- Giữ `LandingData` và `normalizeLandingData` làm contract dữ liệu trung tâm; không tạo cấu trúc dữ liệu UI cạnh tranh nếu chưa được duyệt.
- Không sửa UI chỉ để nhìn đúng tại một viewport mà làm hỏng responsive.
- Khi sửa responsive phải tìm nguyên nhân thực sự trong CSS/layout, container, media query, image sizing hoặc preview scaling.
- Kiểm tra ảnh hưởng tới desktop, tablet và mobile; với editor phải phân biệt preview giả lập thiết bị và viewport thật của trang public.
- Giữ hành vi nhất quán giữa editor và `PublicLanding` vì cả hai dùng renderer chung.
- Không phá drag/drop, section sorting, inline editing, undo/redo, autosave, publish, image handling, image fit hoặc image position hiện có.
- Khi chỉnh section, kiểm tra variant tương ứng trong `landingSectionVariantOptions`, section registry, properties panel và renderer.
- Dùng palette/token hiện có (`ink`, `paper`, `accent`, `soft`, `line`) và cấu hình `LandingData.design` trước khi thêm style cục bộ.
- Không thêm HTML tùy ý hoặc mở rộng `customBlock`/`dangerouslySetInnerHTML` mà chưa đánh giá và xin phép về rủi ro bảo mật.

# 8. TypeScript / JavaScript

- Không dùng `any` tùy tiện.
- Không dùng `@ts-ignore` hoặc ép kiểu để che lỗi nếu có thể sửa đúng nguyên nhân.
- Tận dụng type, interface, union, schema và normalizer hiện có.
- Không tạo type trùng lặp nếu đã có type tương ứng.
- Khi thay đổi type phải tìm các nơi đang tạo, đọc, normalize, serialize và render type đó.
- Tôn trọng `strict` TypeScript và ESM của project.
- Dữ liệu đi qua API, AI hoặc persistence phải được kiểm tra ở runtime; type compile-time không thay thế validation.
- Không tuyên bố type-check thành công nếu chưa chạy một lệnh thực sự kiểm tra TypeScript.

# 9. Backend và API

- Validate input từ client và giới hạn kích thước/định dạng phù hợp.
- Không tin dữ liệu client, model AI hoặc payload đã parse một phần.
- Giữ API contract hiện tại nếu không được yêu cầu thay đổi.
- Với route bảo vệ, xác thực và kiểm tra quyền trước khi xử lý payload hoặc thực hiện tác vụ tốn tài nguyên.
- Dùng các helper hiện có như `getCurrentDatabaseUser`, `getAuthenticatedCompanyContext`, `getAccessibleProject`, `unauthorizedCompanyResponse` và `forbiddenCompanyResponse` thay vì tự tạo cơ chế auth song song.
- Tôn trọng role `owner`, `admin`, `member`, `viewer` và các helper quyền hiện có cho quản trị công ty, tạo/sửa/publish landing page.
- Luôn kiểm tra project/company ownership khi truy cập project, asset, lead, order hoặc integration.
- Phân biệt rõ public route đã publish với dữ liệu draft chỉ dành cho chủ sở hữu/thành viên có quyền.
- Không để lộ secret, credential, session, token hoặc stack trace nhạy cảm trong response/log.
- Không hard-code API key; đọc secret ở server qua runtime environment/Cloudflare bindings theo convention hiện có.
- Khi sửa AI route/pipeline, giữ cơ chế parse, normalize, validate operation và kiểm tra scope trước khi apply; không áp dụng trực tiếp output thô từ model.
- Giữ streaming/progress, usage limit và retry/repair behavior hiện có trừ khi kế hoạch đã duyệt yêu cầu thay đổi.

# 10. Database

- Database thực tế là Cloudflare D1/SQLite, truy cập bằng Drizzle ORM.
- Schema khai báo ở `db/schema.ts`; runtime compatibility/DDL nằm trong `ensureDatabase()` ở `db/index.ts`; migration nằm trong `drizzle/*.sql`.
- Không tự ý thay schema, sửa runtime DDL hoặc tạo migration.
- Không tự ý chạy `npm run db:generate`.
- Không xóa dữ liệu, không chạy destructive command và không sửa production data.
- Mọi thay đổi schema phải được giải thích và xin phép riêng, gồm migration plan, compatibility và rollback/rủi ro dữ liệu.
- Khi schema được duyệt thay đổi, phải kiểm tra tính nhất quán giữa Drizzle schema, runtime database initialization/compatibility và migration liên quan.
- Chú ý hiệu năng query, index, transaction và tránh query dư thừa.
- Không giả định local D1/R2 giống production; state local dưới `.wrangler/` không được coi là dữ liệu production và không được commit.

# 11. Dependency

- Không tự ý cài, xóa hoặc nâng cấp package.
- Trước khi đề xuất package mới phải kiểm tra project đã có giải pháp tương đương chưa.
- Nếu thực sự cần dependency mới, phải giải thích:
  - Package gì và version/range dự kiến.
  - Dùng để làm gì.
  - Tại sao code/dependency hiện tại không đủ.
  - Ảnh hưởng tới bundle, runtime, build và bảo trì.
- Sau đó phải hỏi người dùng trước khi cài hoặc sửa lockfile.

# 12. Kiểm tra và xác minh

- Mức kiểm tra phải tương xứng với phạm vi và rủi ro thay đổi.
- Chạy test tập trung cho phần sửa trước, sau đó chạy suite rộng hơn khi thay đổi chạm shared renderer, data contract, auth, API, database hoặc AI pipeline.
- Các lệnh chuẩn hiện có là `npm run lint`, `npm test` và `npm run build`.
- Vì `npm test` đã chạy build trước khi test, phải báo rõ nếu chỉ chạy một test file hoặc bỏ qua full suite.
- Kiểm tra UI bằng luồng sử dụng thực tế khi thay đổi interaction hoặc responsive; không chỉ dựa vào việc compile thành công.
- Không sửa test chỉ để làm test xanh nếu hành vi sản phẩm đúng phải được giữ nguyên.
- Nếu không chạy được test/lint/build/type-check, phải nói rõ lệnh nào chưa chạy và lý do.

# 13. Git và generated artifacts

- Không commit, push, tạo branch hoặc pull request nếu người dùng chưa yêu cầu rõ.
- Không đưa `.env`, `.env.local`, `.wrangler/`, build output, cache hoặc secret vào Git.
- Không sửa generated artifacts ngoài phạm vi. Nếu một lệnh dự kiến tạo nhiều file, phải nêu rõ trước khi xin duyệt.
- Không dùng lệnh Git phá hủy lịch sử hoặc working tree như `git reset --hard` hay `git checkout --` khi chưa có yêu cầu rõ ràng.

# 14. File và dữ liệu nhạy cảm

Không được:

- Đưa API key vào source code.
- In secret, access token, refresh token, password, session hoặc encryption key ra log.
- Commit `.env` hoặc nội dung credential.
- Hiển thị credential không cần thiết trong câu trả lời.
- Xóa file cấu hình quan trọng.
- Đọc hoặc sao chép nội dung secret nếu chỉ cần xác minh tên biến môi trường.

Các biến nhạy cảm phải tiếp tục đi qua server runtime environment/Cloudflare bindings. Dùng `.env.example` để xác minh tên biến, không dùng giá trị thật làm tài liệu hoặc test fixture.

# 15. Cách trả lời trước khi triển khai

Trước khi code, câu trả lời phải có cấu trúc phù hợp sau:

## Phân tích hiện trạng

Mô tả luồng hiện tại dựa trên code đã đọc.

## Nguyên nhân / vấn đề

Nêu nguyên nhân, vị trí và bằng chứng. Nếu chưa đủ bằng chứng, nói rõ điều chưa xác định.

## File dự kiến thay đổi

- `file A`: thay đổi dự kiến.
- `file B`: thay đổi dự kiến.

## Kế hoạch triển khai

1. Bước triển khai thứ nhất.
2. Bước triển khai tiếp theo.
3. Bước kiểm tra/xác minh.

## Rủi ro / ảnh hưởng

Nêu các luồng, contract, viewport, dữ liệu hoặc quyền có khả năng bị ảnh hưởng.

## Xác nhận

`Bạn có muốn tôi triển khai theo kế hoạch trên không?`

Sau đó PHẢI DỪNG. Không gọi công cụ ghi file, không sửa code và không chạy lệnh tạo artifacts trước khi được duyệt.

# 16. Cách trả lời sau khi triển khai

Sau khi hoàn thành, tóm tắt theo cấu trúc:

## Đã thay đổi

Mô tả ngắn gọn hành vi đã thay đổi.

## File đã sửa

Liệt kê chính xác các file đã sửa và vai trò của thay đổi.

## Cách hoạt động sau thay đổi

Mô tả luồng mới ở mức đủ để người dùng kiểm tra.

## Kiểm tra

- Test: lệnh và kết quả.
- Type-check: lệnh và kết quả, hoặc ghi rõ chưa có/chưa chạy.
- Lint: lệnh và kết quả.
- Build: lệnh và kết quả.

## Việc còn lại / rủi ro

Nêu phần chưa kiểm tra, giới hạn hoặc rủi ro còn lại. Không cần giải thích dài nếu không cần thiết.

# 17. Rule đặc thù của project

## Project-specific rules

### Landing data và renderer

- `LandingData` trong `app/landing-data.ts` là source of truth cho nội dung, design, section order, hidden sections, variant, màu và image presentation.
- Mọi dữ liệu landing mới hoặc dữ liệu từ API/AI phải đi qua `normalizeLandingData` theo đúng luồng hiện có.
- `app/components/LandingCanvas.tsx` là renderer dùng chung cho editor và public page. Khi sửa renderer phải kiểm tra cả `app/Studio.tsx` và `app/PublicLanding.tsx`/`app/p/[slug]/page.tsx`.
- Section được kiểm soát theo catalog hiện có: hero, stats, features, pricing, portfolio, gallery, testimonial, faq, lead form, custom block và final CTA. Không tự thêm section/variant ngoài registry và data contract.
- Variant section, typography, radius và density nằm trong `LandingData.design`; phải dùng contract hiện có thay vì thêm cờ UI rời rạc.
- Template phải đi qua registry ở `app/templates/` và normalization hiện có.

### Design system và editor

- Design token chính là `ink`, `paper`, `accent`, `soft`, `line`, được truyền sang CSS variables `--site-*`; màu từng section nằm trong `sectionColors`.
- Styling hiện tại chủ yếu tập trung ở `app/globals.css` với semantic classes và media queries. Tailwind được import nhưng không phải lý do để thay toàn bộ convention hiện có.
- Section navigation/registry và properties controls nằm trong `app/editor/`; thay đổi tên, variant hoặc capability của section phải đồng bộ các nơi liên quan.
- `Studio.tsx` quản lý phần lớn state bằng React hooks, lưu guest draft trong `localStorage`, và dùng API persistence cho người dùng đăng nhập. Không thêm state manager khác nếu chưa có nhu cầu được duyệt.
- DnD Kit đang điều khiển kéo thả/sắp xếp. Mọi thay đổi pointer/drop zone phải kiểm tra xung đột giữa reorder section, thả asset, inline editing và scroll.
- Image presentation hỗ trợ fit/position theo model hiện có; không làm mất metadata này khi normalize, autosave, publish hoặc render.

### AI landing pipeline

- `/api/ai` phải xác thực/RBAC, validate request, kiểm tra usage và chỉ sau đó mới chạy pipeline hoặc stream tiến độ.
- Planning, target resolution, section content, operation normalization/application và quality evaluation là các tầng riêng; không bỏ qua tầng validation để áp dụng output AI trực tiếp.
- Các contract quan trọng nằm trong `app/landing-manifest.ts`, `app/landing-operation-normalizer.ts`, `app/landing-operations.ts` và `app/landing-project.ts`.
- Chế độ tạo landing hiện tại để trống các image slot; không tự gán asset đã upload. `assign_image` chỉ được dùng khi người dùng yêu cầu chỉnh sửa/gán ảnh rõ ràng.
- Nội dung tự do do AI tạo phải theo ngôn ngữ của prompt gần nhất của người dùng theo rule hiện có.
- Không bịa, thay thế hoặc làm hỏng URL asset nội bộ trong quá trình AI edit/repair.
- Khi sửa prompt phải kiểm tra cả planner/content agent và các test dạng source-contract liên quan, vì chỉ sửa một prompt có thể không thay đổi toàn bộ pipeline.

### Asset handling

- File ảnh nằm trong R2 binding `ASSETS`; D1 chỉ lưu metadata. URL nội bộ có dạng `/api/assets/:id`.
- Upload hiện hỗ trợ JPEG, PNG, WebP và GIF, tối đa 5 MB; API phải tiếp tục kiểm tra MIME, size, authentication, permission và project ownership.
- Asset thuộc project draft không được public; asset của project đã publish có thể được phục vụ public theo route/cache hiện có.
- Không nhúng data URL/blob URL lâu dài vào landing data nếu luồng hiện tại yêu cầu asset R2 đã persist.
- Project cần được persist theo luồng hiện có trước khi upload asset gắn với project.
- Khi sửa upload/drag-drop phải kiểm tra cả input chọn file và thả file từ hệ điều hành, trạng thái loading/error, payload limit `6mb`, asset refresh và thao tác gán ảnh thủ công.

### Authentication và company RBAC

- Project có đăng nhập Google OAuth và password; session được lưu trong D1.
- Role công ty hiện có: `owner`, `admin`, `member`, `viewer`. Phải dùng permission helpers hiện có và giữ kiểm tra `mustChangePassword`.
- Route quản trị thành viên/công ty phải duy trì audit log theo convention hiện có.
- Mọi truy cập project cần phân biệt user owner trực tiếp và company membership/permission.
- Public published landing là ngoại lệ có chủ đích; không được vì ngoại lệ này mà nới quyền cho draft API hoặc unpublished asset.

### Database và Cloudflare runtime

- D1, R2 và runtime env được lấy qua Cloudflare bindings; không tạo kết nối hoặc storage song song nếu chưa được duyệt.
- Khi sửa database phải xem đồng thời `db/schema.ts`, `db/index.ts`, migration hiện có và các API query liên quan.
- Local Cloudflare state ở `.wrangler/` chỉ dành cho phát triển và phải nằm ngoài Git.
- `next.config.ts` có Server Action body limit `6mb` để phù hợp upload ảnh tối đa 5 MB; thay đổi một trong hai giới hạn phải kiểm tra và đồng bộ luồng liên quan.

### Testing conventions

- Test nằm trong `tests/*.test.mjs`, dùng `node:test`/`node:assert`.
- Một số test kiểm tra trực tiếp source contract; một số transpile TypeScript và import module để kiểm tra logic. Không được giả định tất cả test là browser/E2E.
- Khi sửa shared landing behavior, operation pipeline, section draft, AI JSON, auth, company RBAC hoặc template, phải tìm và chạy test tương ứng trước khi cân nhắc full `npm test`.

### Điều chưa xác định

- Repository hiện không khai báo script `type-check` riêng trong `package.json`.
- Chưa xác định được từ repository một CI workflow bắt buộc hoặc quy trình deploy production duy nhất; không được tự suy đoán. Chỉ có thể khẳng định các lệnh local/build và cấu hình Cloudflare/Vinext đã nêu ở trên.
- Nếu tài liệu và code mâu thuẫn, phải kiểm tra implementation/test hiện tại và báo rõ mâu thuẫn trước khi đề xuất thay đổi.
