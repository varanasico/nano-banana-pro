"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Workspace" },
  { href: "/history", label: "Historie" },
  { href: "/presets", label: "Presety" },
  { href: "/settings", label: "Nastavení" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <span className="font-semibold tracking-tight">NANO BANANA PRO Studio</span>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-amber-400 text-neutral-950 font-medium"
                    : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="ml-2 rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            Odhlásit
          </button>
        </nav>
      </div>
    </header>
  );
}
