# Chạy Lumo trên máy Windows

Mã nguồn nằm tại:

`C:\Users\Dell\Documents\Landing page`

## Chạy lần đầu

Mở PowerShell trong thư mục dự án và chạy:

```powershell
npm install
npm run dev
```

Sau đó mở địa chỉ được in trong cửa sổ lệnh, thường là:

`http://localhost:3000`

## Bật AI

Mở file `.env.local` và điền khóa mới vào:

```text
AI_API_KEY=khóa_mới_của_bạn
```

Không gửi khóa vào chat và không đưa `.env.local` lên Git.

## Cho thiết bị khác trong cùng Wi-Fi truy cập

```powershell
npm run dev:lan
```

Windows có thể hỏi quyền Firewall. Chỉ cho phép trên mạng riêng mà bạn tin cậy.

## Chạy bản production cục bộ

```powershell
npm run build
npm run start
```

## Dữ liệu cục bộ

Project, lịch sử chat, lượt AI và ảnh được lưu trong thư mục `.wrangler`.
Thư mục này chỉ nằm trên máy và không được đưa vào Git.
