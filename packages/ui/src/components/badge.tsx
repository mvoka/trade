import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 font-medium transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border text-foreground bg-background",

        // Semantic status variants
        success:
          "border-transparent bg-success-50 text-success-600",
        warning:
          "border-transparent bg-warning-50 text-warning-600",
        destructive:
          "border-transparent bg-destructive-50 text-destructive-600",
        info:
          "border-transparent bg-info-50 text-info-600",

        // Solid semantic variants
        "success-solid":
          "border-transparent bg-success text-success-foreground",
        "warning-solid":
          "border-transparent bg-warning text-warning-foreground",
        "destructive-solid":
          "border-transparent bg-destructive text-destructive-foreground",
        "info-solid":
          "border-transparent bg-info text-info-foreground",

        // Trades-specific variants
        electric:
          "border-transparent bg-trades-electric/20 text-amber-700",
        plumbing:
          "border-transparent bg-trades-plumbing/20 text-blue-700",
      },
      size: {
        sm: "px-2 py-0.5 text-2xs rounded",
        default: "px-2.5 py-0.5 text-xs rounded-md",
        lg: "px-3 py-1 text-sm rounded-md",
      },
      dot: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        dot: true,
        className: "pl-1.5",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      dot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size, dot }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            variant === "success" || variant === "success-solid" ? "bg-success" : "",
            variant === "warning" || variant === "warning-solid" ? "bg-warning" : "",
            variant === "destructive" || variant === "destructive-solid" ? "bg-destructive" : "",
            variant === "info" || variant === "info-solid" ? "bg-info" : "",
            variant === "default" ? "bg-primary" : "",
            variant === "secondary" ? "bg-muted-foreground" : "",
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
