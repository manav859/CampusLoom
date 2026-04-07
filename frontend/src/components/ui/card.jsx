import * as React from "react"
import { cn } from "@/lib/utils"

function Card({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-2xl bg-card p-6 text-sm text-card-foreground shadow-sm ring-1 ring-foreground/[0.04] transition-all duration-300 hover:shadow-premium hover:ring-foreground/[0.08]",
        className
      )}
      {...props} />
  );
}

function CardHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props} />
  );
}

function CardTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-lg font-semibold leading-tight tracking-tight", className)}
      {...props} />
  );
}

function CardDescription({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props} />
  );
}

function CardContent({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-content"
      className={cn("mt-2", className)}
      {...props} />
  );
}

function CardFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-footer"
      className={cn("mt-auto flex items-center pt-4", className)}
      {...props} />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
