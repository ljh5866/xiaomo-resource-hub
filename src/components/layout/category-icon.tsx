import {
  AppWindow,
  BookOpen,
  Folder,
  GraduationCap,
  LayoutTemplate,
  Palette,
  Shapes,
  Type,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  software: AppWindow,
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
