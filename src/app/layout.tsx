import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goal Tracker",
  description: "부부가 함께 기록하는 데일리 Goal Tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
