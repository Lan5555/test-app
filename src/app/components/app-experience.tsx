"use client";

import {
  ArrowUpRight,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Ticket,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const pageNames: Record<string, string> = {
  users: "Student management",
  reviews: "Quiz reviews",
  "reveal-quiz": "Quiz preview",
  "registered-ticket": "Ticket registry",
  "purchase-ticket": "Event registration",
  flyer: "Creative studio",
  chat: "Community",
  "quiz-page": "Assessment",
};

function ContextNavigation({ route }: { route: string }) {
  const [dashboard, setDashboard] = useState("/pages/login");
  useEffect(() => {
    try {
      const admin = JSON.parse(
        sessionStorage.getItem("adminSession") || "null",
      );
      const student = JSON.parse(
        sessionStorage.getItem("userSession") || "null",
      );
      setDashboard(
        admin?.token
          ? "/pages/admin"
          : student?.token
            ? "/pages/student"
            : "/pages/login",
      );
    } catch {
      setDashboard("/pages/login");
    }
  }, []);
  return (
    <header className="hub-contextbar print:hidden">
      <div className="hub-contextbar-inner">
        <Link
          className="hub-wordmark"
          href={dashboard}
          aria-label="Lan's Hub home"
        >
          <span className="hub-brand-icon">
            <GraduationCap size={21} />
          </span>
          <span>Lan&apos;s Hub</span>
        </Link>
        <div className="hub-breadcrumb">
          <ChevronRight size={14} />
          <span>{pageNames[route]}</span>
        </div>
        <nav aria-label="Main navigation" className="hub-context-links">
          {[
            { href: dashboard, label: "Dashboard", icon: LayoutDashboard },
            { href: "/pages/chat", label: "Community", icon: MessageCircle },
            { href: "/pages/votes", label: "Votes", icon: Vote },
            { href: "/pages/purchase-ticket", label: "Tickets", icon: Ticket },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              aria-label={label}
              title={label}
              aria-current={href === `/pages/${route}` ? "page" : undefined}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function AppExperience({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Keep the game layouts intact; the shared appearance provider still themes their controls.
  const game = ["/pages/game", "/pages/embrace", "/pages/embrace-game"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (game) return children;
  const route = pathname.split("/")[2] || "home";
  const contextual = !!pageNames[route] && route !== "quiz-page";
  return (
    <div className="hub-experience" data-hub-route={route}>
      <a className="hub-skip-link" href="#hub-content">
        Skip to content
      </a>
      {contextual && <ContextNavigation route={route} />}
      <div id="hub-content" tabIndex={-1}>
        {children}
      </div>
      {route === "login" && (
        <footer className="hub-auth-footer">
          <span>Lan&apos;s Hub · Learning, connected.</span>
          <Link href="/pages/votes">
            Explore public voting <ArrowUpRight size={14} />
          </Link>
        </footer>
      )}
    </div>
  );
}
