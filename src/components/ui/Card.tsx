import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "article";
}

export function Card({ children, className = "", as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={[
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}
