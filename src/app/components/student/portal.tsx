"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trophy,
  Vote,
  X,
} from "lucide-react";
import Link from "next/link";
import type {
  LogFactory,
  ProductFormData,
  Users,
} from "@/app/helpers/factories";
import {
  blueprintName,
  blueprintPath,
} from "../../../features/blueprint/config";
import { StudyArtwork } from "../study/visuals";

export type PortalScreen = "dashboard" | "shop" | "Misc";
const currency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    amount,
  );
const number = (value: unknown, suffix = "") => {
  const numeric =
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "")
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(numeric) ? `${numeric}${suffix}` : "—";
};

export function PortalSidebar({
  student,
  screen,
  open,
  onClose,
  onNavigate,
  onLogout,
}: {
  student: Users;
  screen: PortalScreen;
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: PortalScreen) => void;
  onLogout: () => void;
}) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="student-nav-backdrop"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside
        id="student-sidebar"
        className={`student-sidebar ${open ? "is-open" : ""}`}
        aria-label="Student navigation"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <Link href="/pages/student" className="study-brand">
          <span>
            <GraduationCap size={23} />
          </span>
          Lan&apos;s Hub<small>STUDENT</small>
        </Link>
        <button
          type="button"
          className="student-nav-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={19} />
        </button>
        <div className="student-sidebar-scroll">
          <p className="student-nav-label">Your learning space</p>
          <nav>
            {[
              {
                screen: "dashboard" as const,
                label: "Overview",
                icon: LayoutDashboard,
              },
              {
                screen: "shop" as const,
                label: "Student shop",
                icon: ShoppingBag,
              },
              { screen: "Misc" as const, label: "My account", icon: Settings2 },
            ].map((item) => (
              <button
                key={item.screen}
                type="button"
                aria-current={screen === item.screen ? "page" : undefined}
                onClick={() => {
                  onNavigate(item.screen);
                  onClose();
                }}
              >
                <item.icon size={18} />
                {item.label}
                {screen === item.screen && (
                  <span className="student-nav-active" />
                )}
              </button>
            ))}
            <Link href={blueprintPath}>
              <GitBranch size={18} />
              {blueprintName}
              <ArrowUpRight size={13} />
            </Link>
            <Link href="/pages/reviews">
              <BookOpen size={18} />
              My quiz reviews
              <ArrowUpRight size={13} />
            </Link>
          </nav>
          <p className="student-nav-label">Beyond the classroom</p>
          <nav>
            <Link href="/pages/votes">
              <Vote size={18} />
              Community voting
              <ArrowUpRight size={13} />
            </Link>
            <Link href="/pages/chat">
              <MessageCircle size={18} />
              Conversations
              <ArrowUpRight size={13} />
            </Link>
          </nav>
          <div className="student-sidebar-note">
            <Sparkles size={21} />
            <strong>
              Small steps.
              <br />
              Meaningful progress.
            </strong>
            <p>Every question is a chance to learn something new.</p>
          </div>
        </div>
        <div className="student-sidebar-profile">
          <span className="student-avatar">
            {student.name?.trim().charAt(0).toUpperCase() || (
              <GraduationCap size={18} />
            )}
          </span>
          <div>
            <strong>{student.name || "Student account"}</strong>
            <small>{student.email || "Learning portal"}</small>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function PortalHeader({
  screen,
  onOpenMenu,
  cartCount,
  onOpenShop,
  menuOpen = false,
}: {
  screen: PortalScreen;
  onOpenMenu: () => void;
  cartCount: number;
  onOpenShop: () => void;
  menuOpen?: boolean;
}) {
  return (
    <header className="student-topbar">
      <div>
        <button
          type="button"
          className="student-menu-button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="student-sidebar"
        >
          <Menu size={20} />
        </button>
        <span>My workspace</span>
        <ChevronRight size={13} />
        <strong>
          {screen === "dashboard"
            ? "Overview"
            : screen === "shop"
              ? "Student shop"
              : "My account"}
        </strong>
      </div>
      <button type="button" className="student-cart-link" onClick={onOpenShop}>
        <ShoppingCart size={16} />
        <span>Your cart</span>
        <small>{cartCount}</small>
      </button>
    </header>
  );
}

export function PortalDashboard({
  student,
  reviews,
  loading,
  error,
  search,
  onSearch,
  onRetry,
  onReveal,
  onShop,
}: {
  student: Users;
  reviews: LogFactory[];
  loading: boolean;
  error: string;
  search: string;
  onSearch: (value: string) => void;
  onRetry: () => void;
  onReveal: () => void;
  onShop: () => void;
}) {
  const filtered = reviews.filter((review) =>
    review.name.toLowerCase().includes(search.toLowerCase()),
  );
  const deadline =
    student.deadline && Number.isFinite(Date.parse(student.deadline))
      ? new Date(student.deadline)
      : null;
  const expired = deadline && deadline.getTime() < Date.now();
  return (
    <div className="student-content">
      <div className="student-page-heading">
        <div>
          <p className="study-eyebrow">Your next chapter starts here</p>
          <h1>A little progress, every day.</h1>
          <p>
            Welcome back{student.name ? `, ${student.name.split(" ")[0]}` : ""}.
            Make today a good day to learn.
          </p>
        </div>
        <span
          className={`student-status ${student.activated ? "is-active" : ""}`}
        >
          <span />
          {student.activated ? "Account active" : "Activation required"}
        </span>
      </div>
      <section className="student-welcome">
        <div>
          <span className="student-welcome-tag">
            <Sparkles size={13} />A curious mind goes a long way
          </span>
          <h2>
            Your potential.
            <br />
            <em>In progress.</em>
          </h2>
          <p>
            Challenge what you know, discover what you don&apos;t, and keep
            building your confidence.
          </p>
          <button
            type="button"
            className="study-button-light"
            onClick={onReveal}
          >
            Reveal your quiz <ArrowUpRight size={16} />
          </button>
          <Link href="/pages/reviews" className="student-welcome-link">
            Review your answers <ArrowRight size={14} />
          </Link>
        </div>
        <StudyArtwork />
      </section>
      <section className="student-metrics" aria-label="Your learning overview">
        {[
          {
            label: "Recorded score",
            value: number(student.score, "%"),
            icon: Trophy,
            detail: "From your student record",
            tone: "lilac",
          },
          {
            label: "Available attempts",
            value: number(student.codeInfo?.attempts),
            icon: BookOpen,
            detail: "Ready for your next assessment",
            tone: "blue",
          },
          {
            label: "Time per question",
            value: number(student.time, "s"),
            icon: Clock3,
            detail: "Your configured time allowance",
            tone: "peach",
          },
          {
            label: "Quiz reviews",
            value: loading || error ? "—" : String(reviews.length),
            icon: Check,
            detail: "Saved assessment records",
            tone: "mint",
          },
        ].map((item) => (
          <article className="student-metric" key={item.label}>
            <div>
              <span>{item.label}</span>
              <span className={`student-metric-icon tone-${item.tone}`}>
                <item.icon size={18} />
              </span>
            </div>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>
      <div className="student-dashboard-grid">
        <section className="study-panel">
          <div className="study-panel-heading">
            <div>
              <p className="study-eyebrow">See how far you&apos;ve come</p>
              <h2>Your learning story</h2>
            </div>
            <Link href="/pages/reviews">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <label className="student-search">
            <Search size={17} />
            <span className="sr-only">Search your quiz reviews</span>
            <input
              type="search"
              placeholder="Find a quiz review…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </label>
          {loading ? (
            <div className="student-inline-state" aria-live="polite">
              Loading your saved reviews…
            </div>
          ) : error ? (
            <div className="student-inline-state">
              <p role="alert">{error}</p>
              <button
                type="button"
                className="study-button-outline"
                onClick={onRetry}
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="student-inline-state">
              <span className="student-empty-icon">
                <BookOpen size={26} />
              </span>
              <h3>
                {search
                  ? "No matching reviews."
                  : "Your story is just getting started."}
              </h3>
              <p>
                {search
                  ? "Try another quiz name."
                  : "Your completed assessments will appear here once their reviews are saved."}
              </p>
            </div>
          ) : (
            <div className="student-review-list">
              {filtered.map((review, index) => (
                <Link
                  href="/pages/reviews"
                  className="student-review-row"
                  key={review.id ?? `${review.completedDate}-${review.name}`}
                >
                  <span
                    className={`student-review-symbol tone-${index % 2 ? "blue" : "lilac"}`}
                  >
                    <BookOpen size={19} />
                  </span>
                  <div>
                    <strong>{review.name}</strong>
                    <small>
                      {Number.isFinite(Date.parse(review.completedDate))
                        ? new Date(review.completedDate).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "Assessment review"}
                    </small>
                  </div>
                  <div className="student-review-score">
                    <strong>{number(review.score, "%")}</strong>
                    <div>
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, review.score || 0))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="student-right-column">
          <section className="study-panel student-deadline">
            <span className="student-deadline-icon">
              <Clock3 size={22} />
            </span>
            <p className="study-eyebrow">Keep an eye on the clock</p>
            <h2>
              {deadline
                ? expired
                  ? "Deadline passed"
                  : "Your next deadline"
                : "Room to keep learning"}
            </h2>
            <strong>
              {deadline
                ? deadline.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No deadline set"}
            </strong>
            <p>
              {deadline
                ? expired
                  ? "Check with your tutor about your assessment availability."
                  : `Your assessment is due by ${deadline.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}. Plan a little time to prepare.`
                : "No assessment deadline is currently listed on your student record."}
            </p>
          </section>
          <section className="student-shop-promo">
            <span>
              <ShoppingBag size={21} />
            </span>
            <h2>
              A little extra
              <br />
              for your next step.
            </h2>
            <p>
              Explore the available items and learning upgrades in your student
              shop.
            </p>
            <button type="button" onClick={onShop}>
              Explore the shop <ArrowUpRight size={16} />
            </button>
          </section>
          <Link className="student-community-link" href="/pages/votes">
            <Vote size={21} />
            <span>
              <strong>Your community. Your voice.</strong>
              <small>See who&apos;s in the spotlight.</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

export function PortalShop({
  products,
  loading,
  error,
  onRetry,
  cart,
  onAdd,
  onRemove,
  onCheckout,
}: {
  products: ProductFormData[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  cart: Record<number, number>;
  onAdd: (product: ProductFormData) => void;
  onRemove: (id: number) => void;
  onCheckout: () => void;
}) {
  const selected = products.filter((product) => cart[product.id]);
  const total = selected.reduce(
    (sum, product) => sum + product.price * cart[product.id],
    0,
  );
  return (
    <div className="student-content">
      <div className="student-page-heading">
        <div>
          <p className="study-eyebrow">Make room for what&apos;s next</p>
          <h1>Your learning, with a little extra.</h1>
          <p>
            Browse available items, build your order, and keep moving forward.
          </p>
        </div>
      </div>
      <div className="student-shop-layout">
        <section>
          {loading ? (
            <div
              className="study-panel student-inline-state"
              aria-live="polite"
            >
              Loading available products…
            </div>
          ) : error ? (
            <div className="study-panel student-inline-state">
              <p role="alert">{error}</p>
              <button
                type="button"
                className="study-button-outline"
                onClick={onRetry}
              >
                Try again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="study-panel student-inline-state">
              <Package size={30} />
              <h2>The shelves are getting ready.</h2>
              <p>
                Available products will appear here when they&apos;re added to
                the shop.
              </p>
            </div>
          ) : (
            <div className="student-products">
              {products.map((product, index) => (
                <article
                  className="study-panel student-product"
                  key={product.id}
                >
                  <div
                    className={`student-product-art tone-${index % 2 ? "blue" : "lilac"}`}
                  >
                    <span>{product.icon || <Package size={32} />}</span>
                    <span className="student-product-art-orbit" />
                  </div>
                  <div className="student-product-body">
                    <strong>{currency(product.price)}</strong>
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <button
                      type="button"
                      className="study-button-outline"
                      onClick={() => onAdd(product)}
                    >
                      <Plus size={16} />
                      Add to cart
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="study-panel student-cart">
          <div className="study-panel-heading">
            <h2>Your cart</h2>
            <ShoppingCart size={19} />
          </div>
          {selected.length === 0 ? (
            <div className="student-inline-state">
              <span className="student-empty-icon">
                <ShoppingBag size={25} />
              </span>
              <h3>A little space for possibility.</h3>
              <p>Add something from the shop to get started.</p>
            </div>
          ) : (
            <>
              <div className="student-cart-items">
                {selected.map((product) => (
                  <div key={product.id}>
                    <strong>{product.name}</strong>
                    <small>{currency(product.price)} each</small>
                    <div className="student-cart-quantity">
                      <button
                        type="button"
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => onRemove(product.id)}
                      >
                        <Minus size={14} />
                      </button>
                      <span>{cart[product.id]}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${product.name}`}
                        onClick={() => onAdd(product)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="student-cart-total">
                <span>Total</span>
                <strong>{currency(total)}</strong>
              </div>
              <button
                type="button"
                className="study-button-primary"
                onClick={onCheckout}
              >
                Continue to checkout <ArrowUpRight size={17} />
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export function PortalAccount({ student }: { student: Users }) {
  return (
    <div className="student-content">
      <div className="student-page-heading">
        <div>
          <p className="study-eyebrow">The essentials, in one place</p>
          <h1>Your student account.</h1>
          <p>
            Your profile and assessment settings, as provided by the service.
          </p>
        </div>
      </div>
      <div className="student-account-grid">
        <section className="study-panel">
          <div className="study-panel-heading">
            <h2>Personal details</h2>
            <GraduationCap size={21} />
          </div>
          <dl className="student-account-records">
            {[
              ["Name", student.name || "Not available"],
              ["Email", student.email || "Not available"],
              ["Current program", student.currentProgram || "Not assigned"],
              ["Account access", student.activated ? "Active" : "Inactive"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="study-panel">
          <div className="study-panel-heading">
            <h2>Assessment settings</h2>
            <BookOpen size={21} />
          </div>
          <dl className="student-account-records">
            {[
              [
                "Quiz",
                student.quizId ? `Quiz ${student.quizId}` : "Not assigned",
              ],
              ["Available attempts", number(student.codeInfo?.attempts)],
              ["Time per question", number(student.time, " seconds")],
              [
                "Deadline",
                student.deadline &&
                Number.isFinite(Date.parse(student.deadline))
                  ? new Date(student.deadline).toLocaleString()
                  : "Not set",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="student-account-note">
            Contact your tutor if your profile or assessment settings need to be
            updated.
          </p>
        </section>
      </div>
    </div>
  );
}
