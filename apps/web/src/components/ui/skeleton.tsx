import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const skeletonVariants = cva("animate-pulse rounded-md bg-primary/10", {
  variants: {
    size: {
      default: "h-4 w-full",
      sm: "h-3 w-3/4",
      lg: "h-6 w-full",
      avatar: "h-12 w-12 rounded-full",
      card: "h-[200px] w-full",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, size, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ size }), className)}
      {...props}
    />
  )
}

export { Skeleton }
