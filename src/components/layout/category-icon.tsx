import {
  AppWindow,
  BookOpen,
  Folder,
  Gamepad2,
  Github,
  GraduationCap,
  LayoutTemplate,
  Palette,
  Puzzle,
  Shapes,
  Type,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  // 当前使用的 4 个分类
  software: AppWindow,
  games: Gamepad2,
  mods: Puzzle,
  opensource: Github,

  // 历史分类保留映射：数据库里若有旧数据，图标不会掉成默认文件夹
  template: LayoutTemplate,
  material: Palette,
  course: GraduationCap,
  font: Type,
  icon: Shapes,
  ebook: BookOpen,
};

export function CategoryIcon({
  slug,
  className = "size-5",
}: {
  slug: string;
  className?: string;
}) {
  const Icon = MAP[slug] ?? Folder;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
