"use client";
import { MotionConfig } from "motion/react";
import type { CSSProperties, ElementType, ReactNode } from "react";

/** Mọi chuyển động của thư viện motion tôn trọng cài đặt «giảm chuyển động» của hệ điều hành. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RevealProps {
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Hiện dần và trượt lên nhẹ khi cuộn tới, làm bằng CSS (scroll-driven animation).
 * Trình duyệt chưa hỗ trợ thì phát hiệu ứng một lần khi tải trang; tắt hẳn khi bật «giảm chuyển động».
 * Nội dung không bao giờ bị ẩn nếu JavaScript lỗi.
 */
export function Reveal({ as: Tag = "div", delay = 0, className = "", style, children }: RevealProps) {
  return (
    <Tag className={`reveal-up ${className}`} style={{ ...style, ["--reveal-delay" as string]: `${delay}s` }}>
      {children}
    </Tag>
  );
}
