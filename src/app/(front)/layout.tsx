import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/**
 * 前台布局：带站点 header / footer。
 * 后台不在这层 —— 它有自己的全屏侧栏布局，见 app/admin/layout.tsx。
 */
export default function FrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
