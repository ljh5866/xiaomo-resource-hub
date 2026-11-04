import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/session-provider";
import { site } from "@/content/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.baseUrl),
  title: {
    default: site.seo.title,
    template: `%s · ${site.name}`,
  },
  description: site.seo.description,
  keywords: [...site.seo.keywords],
  applicationName: site.name,
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: site.name,
    title: site.seo.title,
    description: site.seo.description,
    images: [
      {
        url: `/api/og?title=${encodeURIComponent(site.name)}&sub=${encodeURIComponent("软件 · 游戏 · MOD · 开源项目")}`,
        width: 1200,
        height: 630,
        alt: site.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.seo.title,
    description: site.seo.description,
    images: [
      `/api/og?title=${encodeURIComponent(site.name)}&sub=${encodeURIComponent("软件 · 游戏 · MOD · 开源项目")}`,
    ],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-accent focus:bg-surface focus:px-4 focus:py-2 focus:text-sm"
        >
          跳到主要内容
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
