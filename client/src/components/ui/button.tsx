import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]",
    {
        variants: {
            variant: {
                default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md hover:shadow-lg hover:bg-[hsl(217,89%,55%)] active:shadow-sm active:bg-[hsl(217,89%,50%)]",
                destructive: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] shadow-md hover:shadow-lg hover:bg-[hsl(4,90%,52%)] active:shadow-sm active:bg-[hsl(4,90%,48%)]",
                outline: "border-2 border-[hsl(var(--primary))] bg-transparent text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] active:bg-[hsl(217,89%,55%)]",
                secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(0,0%,90%)] active:bg-[hsl(0,0%,85%)]",
                ghost: "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] active:bg-[hsl(0,0%,90%)]",
                link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline hover:text-[hsl(217,89%,55%)]",
            },
            size: {
                default: "h-10 px-6 py-2 min-h-[44px] text-sm",
                sm: "h-9 rounded-md px-4 min-h-[44px] min-w-[44px] text-xs",
                lg: "h-12 rounded-md px-8 min-h-[44px] text-base",
                icon: "h-10 w-10 min-h-[44px] min-w-[44px]",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp 
                className={cn(buttonVariants({ variant, size, className }))} 
                ref={ref} 
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...props.style }}
                {...props} 
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };

