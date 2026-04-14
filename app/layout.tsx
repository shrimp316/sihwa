import type { Metadata } from "next";
import { Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSerifKR = Noto_Serif_KR({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "글빛을 모아 담다 시화 詩和",
  description: "시화 詩和 — 글빛을 모아 담다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSerifKR.variable} ${notoSansKR.variable}`}>
      <body>{children}</body>
    </html>
  );
}
