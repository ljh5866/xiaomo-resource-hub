import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AuthProvider } from "@/components/auth/session-provider";
import { site } from "@/content/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.baseUrl),
  title: {
    default: site.seo.title,
    template: `%s · ${site.name}`,
  },
  description: site.seo.description,
  keywords: [...site.seo.keywords],
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: site.name,
    title: site.seo.title,
    description: site.seo.description,
    images: [
      {
        url: `/api/og?title=${encodeURIComponent(site.name)}&sub=${encodeURIComponent("认真归档的好用资源 · 只做索引")}`,
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
      `/api/og?title=${encodeURIComponent(site.name)}&sub=${encodeURIComponent("认真归档的好用资源 · 只做索引")}`,
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
        <AuthProvider>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
