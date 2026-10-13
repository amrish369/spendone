import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, LogOut, Home, Plus, CalendarCheck, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OFFLINE_CHANGE_EVENT, pendingCount, syncPendingChanges } from "@/lib/offline";
import {
  useAttendance,
  useCategories,
  useCustomers,
  useLedgerEntries,
  useStaff,
  useTransactions,
  useWorkDays,
  useWorkLogs,
} from "@/lib/data";

/** Loads all core data once signed in so every page has an on-device copy for offline use. */
function OfflineWarmup() {
  useTransactions();
  useCategories();
  useStaff();
  useAttendance();
  useWorkLogs();
  useWorkDays();
  useCustomers();
  useLedgerEntries();
  return null;
}

const NAV = [
  { to: "/", label: "🏠 Home" },
  { to: "/len-den", label: "📝 Transactions" },
  { to: "/add", label: "➕ Add" },
  { to: "/category", label: "📈 Categories" },
  { to: "/month", label: "📅 Monthly" },
  { to: "/attendance", label: "🧑‍🏭 Attendance" },
  { to: "/calendar", label: "📆 Calendar & Salary" },
  { to: "/khatabook", label: "📒 Ledger" },
  { to: "/funding", label: "💬 Message" },
  { to: "/salary-message", label: "💰 Salary Message" },
  { to: "/notes", label: "🗒️ Note Pad" },
  { to: "/export", label: "📥 Excel" },
  { to: "/settings", label: "⚙️ Settings" },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const refreshPending = () => {
      if (user) void pendingCount(user.id).then(setPending);
    };
    const sync = async () => {
      setIsOnline(navigator.onLine);
      if (!user || !navigator.onLine) return refreshPending();
      const result = await syncPendingChanges(user.id);
      setPending(result.remaining);
      if (result.synced > 0) {
        await Promise.all(
          ["transactions", "attendance", "work_logs", "work_days"].map((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          ),
        );
        toast.success(`Synced ${result.synced} saved ${result.synced === 1 ? "change" : "changes"}.`);
      }
    };
    const onQueueChange = () => {
      refreshPending();
      if (navigator.onLine) void sync();
    };
    const onOnline = () => void sync();
    const onOffline = () => setIsOnline(false);
    void sync();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OFFLINE_CHANGE_EVENT, onQueueChange);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OFFLINE_CHANGE_EVENT, onQueueChange);
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const signOut = async () => {
    queryClient.clear();
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
    <div className="min-h-screen bg-background pb-24 md:pb-16">
      <header className="brand-gradient sticky top-0 z-40 flex items-center gap-3 px-4 py-3 text-primary-foreground shadow-lg">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Menu"
              className="rounded-lg p-2 transition-colors hover:bg-white/15"
            >
              <Menu className="size-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <div className="brand-gradient px-5 py-6">
              <p className="text-lg font-semibold text-primary-foreground">📋 Menu</p>
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
                <LogOut className="size-4" /> Logout
              </button>
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          aria-label="Logout"
          className="text-primary-foreground hover:bg-white/15"
        >
          <LogOut className="size-5" />
        </Button>
      </header>
      <div
        role="status"
        className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium ${isOnline ? "bg-success/10 text-success" : "bg-warning/15 text-warning-foreground"}`}
      >
        <span aria-hidden="true" className={`size-2 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`} />
        {isOnline ? (pending > 0 ? `Online · ${pending} change${pending === 1 ? "" : "s"} waiting to sync` : "Online · synced") : `Offline · ${pending > 0 ? `${pending} saved change${pending === 1 ? "" : "s"} waiting to sync` : "showing saved data"}`}
      </div>
      <OfflineWarmup />
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5 items-center">
          {[
            { to: "/", label: "Home", Icon: Home },
            { to: "/add", label: "Add", Icon: Plus },
            { to: "/attendance", label: "Attendance", Icon: CalendarCheck },
            { to: "/funding", label: "Message", Icon: MessageCircle },
          ].map(({ to, label, Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Button
                key={to}
                asChild
                variant={active ? "secondary" : "ghost"}
                className={`h-14 w-full flex-col gap-1 rounded-md px-1 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Link to={to} aria-current={active ? "page" : undefined}>
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </Link>
              </Button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(true)}
            aria-label="Open all pages menu"
            className="h-14 w-full flex-col gap-1 rounded-md px-1 text-xs text-muted-foreground"
          >
            <Menu className="size-5 shrink-0" aria-hidden="true" />
            <span>More</span>
          </Button>
        </div>
      </nav>
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
