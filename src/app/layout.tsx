import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PomoDongyo — 곡 단위 포모도로",
  description: "플레이리스트의 곡으로 집중 시간을 채우는 포모도로 타이머",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
