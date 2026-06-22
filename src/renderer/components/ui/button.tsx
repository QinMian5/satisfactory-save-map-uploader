// abstract: shadcn-style button primitive for the local React renderer.
// out_of_scope: Application commands, Electron IPC, and non-button controls.

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border-primary bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        destructive:
          "border-destructive-border bg-card text-destructive hover:bg-destructive-background",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, variant, type = "button", ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        className={cn(buttonVariants({ variant }), className)}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
