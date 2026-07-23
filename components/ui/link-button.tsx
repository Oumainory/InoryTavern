// 兼容 shadcn@latest (base-nova) 没有 asChild 的情况
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type Size = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

export function LinkButton({
  href,
  className,
  variant,
  size,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href as never}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
