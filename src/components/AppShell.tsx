import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect } from "react";

const NAV = [
  { to: "/", label: "🏠 मुख्य" },
  { to: "/len-den", label: "📝 लेन-देन" },
  { to: "/add", label: "➕ जोड़ें" },
  { to: "/category", label: "📈 श्रेणी" },
  { to: "/month", label: "📅 मासिक" },
  { to: "/attendance", label: "🧑‍🏭 हाज़िरी" },
  { to: "/khatabook", label: "📒 खाता-बही" },
  { to: "/funding", label: "💬 मैसेज" },
  { to: "/export", label: "📥 एक्सेल" },
  { to: "/settings", label: "⚙️ सेटिंग्स" },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="brand-gradient sticky top-0 z-40 flex items-center gap-3 px-4 py-3 text-primary-foreground shadow-lg">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="मेनू"
              className="rounded-lg p-2 transition-colors hover:bg-white/15"
            >
              <Menu className="size-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <div className="brand-gradient px-5 py-6">
              <p className="text-lg font-semibold text-primary-foreground">📋 मेनू</p>
              <p className="mt-1 truncate text-xs text-primary-foreground/80">{user.email}</p>
            </div>
            <nav className="flex flex-col gap-1 p-3">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    pathname === item.to
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={signOut}
                className="mt-2 flex items-center gap-2 rounded-lg px-4 py-3 text-left text-base font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              >
                <LogOut className="size-4" /> लॉगआउट
              </button>
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          aria-label="लॉगआउट"
          className="text-primary-foreground hover:bg-white/15"
        >
          <LogOut className="size-5" />
        </Button>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "expense" | "income" | "balance";
}) {
  const toneClass =
    tone === "expense"
      ? "text-destructive"
      : tone === "income"
        ? "text-success"
        : tone === "balance"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="surface p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
