"use client";

// 轻量的 RadioGroup 组件：基于 @radix 风格的可访问性，纯受控 + 键盘可用
// 因为本项目没有引入 @base-ui/react/radio，这里手写一份最小可用版本。
// 用法：
//   <RadioGroup value={x} onValueChange={setX} options={[{value,label,description}]} />

import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  value: string;
  onValueChange: (v: string) => void;
  options: RadioOption[];
  className?: string;
  // "card"：每个选项是整行可点击的卡片（适合有 description 的场景）
  // "inline"：紧凑的横向小标签（适合标签很短的场景）
  variant?: "card" | "inline";
  disabled?: boolean;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  className,
  variant = "card",
  disabled,
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cn(
        variant === "card"
          ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
          : "flex flex-wrap gap-2",
        className
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "text-left rounded-lg border transition-all outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              variant === "card"
                ? cn(
                    "px-3 py-2.5",
                    selected
                      ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-background hover:bg-muted/50 dark:bg-input/20"
                  )
                : cn(
                    "px-3 py-1.5 text-sm",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted dark:bg-input/30"
                  )
            )}
          >
            <div
              className={cn(
                "font-medium",
                variant === "card" ? "text-sm" : "text-sm"
              )}
            >
              {opt.label}
            </div>
            {opt.description && variant === "card" && (
              <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                {opt.description}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
