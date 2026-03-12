import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-[var(--mf-accent)] text-[var(--mf-on-accent)] hover:bg-[var(--mf-accent-hover)]": variant === "default",
            "border border-[var(--mf-border)] bg-transparent hover:bg-[var(--mf-surface-muted)] text-[var(--mf-text)]": variant === "outline",
            "hover:bg-[var(--mf-surface-muted)] text-[var(--mf-text)]": variant === "ghost",
            "bg-[var(--mf-surface)] text-[var(--mf-text)] hover:bg-[var(--mf-surface-muted)]": variant === "secondary",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
