import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const inputVariants = cva(
  [
    "flex w-full bg-background text-foreground transition-all duration-200",
    "border border-input rounded-lg",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-8 px-3 py-1.5 text-xs rounded-md",
        default: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-4 py-3 text-base",
      },
      variant: {
        default: "",
        filled: "bg-muted border-transparent focus-visible:bg-background focus-visible:border-input",
        ghost: "border-transparent bg-transparent focus-visible:bg-muted/50",
      },
      error: {
        true: "border-destructive text-destructive focus-visible:ring-destructive focus-visible:border-destructive",
        false: "",
      },
      success: {
        true: "border-success focus-visible:ring-success focus-visible:border-success",
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
      error: false,
      success: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, variant, error, success, leftIcon, rightIcon, ...props }, ref) => {
    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ size, variant, error, success }),
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ size, variant, error, success }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
