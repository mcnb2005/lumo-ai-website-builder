import type { Metadata } from "next";
import { Studio } from "./Studio";

export const metadata: Metadata = {
  title: "Lumo — Tạo landing page bằng AI",
  description:
    "Tạo, chỉnh sửa và xuất bản landing page chuyên nghiệp chỉ bằng hội thoại.",
};

export default function Home() {
  return <Studio />;
}
