import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none",
          variant === "default" && "bg-indigo-600 text-white hover:bg-indigo-700 shadow-soft",
          variant === "secondary" && "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
          variant === "outline" && "border border-indigo-200 text-indigo-700 hover:bg-indigo-50",
          variant === "ghost" && "text-indigo-700 hover:bg-indigo-50",
          size === "default" && "h-10 px-4",
          size === "sm" && "h-8 px-3 text-xs",
          size === "icon" && "h-9 w-9",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
