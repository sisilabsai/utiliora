import {
  Calculator,
  Code2,
  Image as ImageIcon,
  Search,
  SquareKanban,
  Waypoints,
  type LucideProps,
} from "lucide-react";
import type { ToolCategorySlug } from "@/lib/types";

interface CategoryIconProps extends Omit<LucideProps, "ref"> {
  category: ToolCategorySlug;
}

export function CategoryIcon({ category, size = 16, ...props }: CategoryIconProps) {
  switch (category) {
    case "calculators":
      return <Calculator size={size} {...props} />;
    case "converters":
      return <Waypoints size={size} {...props} />;
    case "seo-tools":
      return <Search size={size} {...props} />;
    case "image-tools":
      return <ImageIcon size={size} {...props} />;
    case "developer-tools":
      return <Code2 size={size} {...props} />;
    case "productivity-tools":
      return <SquareKanban size={size} {...props} />;
    default:
      return <Search size={size} {...props} />;
  }
}
