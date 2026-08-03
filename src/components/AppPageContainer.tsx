import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tailwind-friendly alias; real value lives in `--app-content-max-width`. */
export const appPageContainerClass = "app-page-container";

type AppPageContainerProps = {
  as?: "div" | "main";
  className?: string;
  children?: ReactNode;
};

/**
 * Shared authenticated page shell: same max-width and horizontal padding
 * for AppShellHeader and main content so routes align edge-to-edge.
 */
export function AppPageContainer({
  as,
  className,
  children,
}: AppPageContainerProps) {
  const Comp: ElementType = as ?? "div";
  return <Comp className={cn(appPageContainerClass, className)}>{children}</Comp>;
}
