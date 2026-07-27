import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ||
    incomingHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "Lumo — Tạo landing page bằng AI",
      template: "%s · Lumo",
    },
    description:
      "Tạo, chỉnh sửa và tự xuất bản landing page chuyên nghiệp chỉ bằng hội thoại.",
    openGraph: {
      title: "Lumo — Biến ý tưởng thành landing page",
      description:
        "Chat với AI, xem thay đổi trực tiếp và xuất bản chỉ trong vài phút.",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Lumo — Biến ý tưởng thành landing page",
      description:
        "Chat với AI, xem thay đổi trực tiếp và xuất bản chỉ trong vài phút.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
