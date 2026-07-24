"use client";

// 移动端抽屉组件（基于 @base-ui/react/dialog 实现）
// 用法：
//   <Sheet open={open} onOpenChange={setOpen}>
//     <SheetContent side="left">
//       ... 内容 ...
//     </SheetContent>
//   </Sheet>
//
// 与 Dialog 的区别：抽屉从屏幕边缘滑入，半屏宽，常用于移动端导航。
// 桌面端可作为侧边导航使用。

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

interface SheetContentProps extends DialogPrimitive.Popup.Props {
  side?: "left" | "right" | "top" | "bottom";
  showCloseButton?: boolean;
}

function SheetContent({
  className,
  children,
  side = "left",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  // 抽屉的滑入/滑出动画 + 定位
  const sideClasses = {
    left: cn(
      "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r",
      "data-open:animate-in data-open:slide-in-from-left",
      "data-closed:animate-out data-closed:slide-out-to-left"
    ),
    right: cn(
      "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l",
      "data-open:animate-in data-open:slide-in-from-right",
      "data-closed:animate-out data-closed:slide-out-to-right"
    ),
    top: cn(
      "inset-x-0 top-0 w-full h-1/3 max-h-sm border-b",
      "data-open:animate-in data-open:slide-in-from-top",
      "data-closed:animate-out data-closed:slide-out-to-top"
    ),
    bottom: cn(
      "inset-x-0 bottom-0 w-full h-1/3 max-h-sm border-t",
      "data-open:animate-in data-open:slide-in-from-bottom",
      "data-closed:animate-out data-closed:slide-out-to-bottom"
    ),
  }[side];

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 bg-popover text-popover-foreground shadow-lg duration-200 outline-none",
          sideClasses,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base font-medium", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
};
