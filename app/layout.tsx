import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "画像配信管理 | Shirasaka Flower",
  description: "Amazon注文の画像配信・レビュー依頼を効率管理するアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
