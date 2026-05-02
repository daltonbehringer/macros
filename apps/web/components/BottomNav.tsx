"use client";

import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today", icon: HomeIcon },
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/recipes", label: "Recipes", icon: BookIcon },
  { href: "/history", label: "History", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];

// /chat owns the bottom of the viewport with its own input bar; the rest of
// the auth flow has no nav scope.
const HIDDEN_ON = ["/login", "/auth/callback", "/chat"];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <a
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] uppercase tracking-widest ${
                  active
                    ? "text-[color:var(--color-accent)]"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Inline icons — no external dep. 24x24 viewBox, currentColor stroke.
// ---------------------------------------------------------------------------

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-3" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="m4.93 4.93 2.12 2.12" />
      <path d="m16.95 16.95 2.12 2.12" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="m4.93 19.07 2.12-2.12" />
      <path d="m16.95 7.05 2.12-2.12" />
    </svg>
  );
}
