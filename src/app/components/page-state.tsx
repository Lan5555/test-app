import { BookOpen, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function PageState({
  title,
  description,
  icon: Icon = BookOpen,
  loading = false,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="hub-page-state" aria-live="polite" aria-busy={loading}>
      <div className="hub-state-card">
        <div className="hub-state-icon">
          {loading ? (
            <LoaderCircle size={28} className="animate-spin" />
          ) : (
            <Icon size={28} />
          )}
        </div>
        <p className="hub-state-eyebrow">Lan&apos;s Hub</p>
        <h1>{title}</h1>
        <p className="hub-state-description">{description}</p>
        {children && <div className="hub-state-actions">{children}</div>}
      </div>
    </section>
  );
}
