import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login – Expense Tracker" },
      { name: "description", content: "Log in to manage your expenses, attendance and daily allowance." },
      { property: "og:title", content: "Login – Expense Tracker" },
      { property: "og:description", content: "Sign in to your expense and attendance account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const features = [
    { icon: "📝", title: "Track Expenses", desc: "Log income & spending with custom categories." },
    { icon: "🧑‍🏭", title: "Staff Attendance", desc: "Mark Present, Traveling or Absent — DA auto-added." },
    { icon: "📆", title: "Work Calendar", desc: "Mark working days, holidays & auto-calc salary." },
    { icon: "📒", title: "Khatabook", desc: "Customer ledgers, balances & WhatsApp reminders." },
    { icon: "🗒️", title: "Note Pad", desc: "Record work session start/close times per day." },
    { icon: "📥", title: "Excel Export", desc: "Download by month, date range or category." },
  ];

  return (
    <div className="brand-gradient min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <div className="text-center text-primary-foreground">
          <p className="text-5xl">💰</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Expense Tracker</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-primary-foreground/85">
            All-in-one manager for field expenses, staff attendance, daily allowance, salary,
            customer ledgers and daily notes — built for shop owners and field teams.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Feature highlights */}
          <div className="rounded-3xl bg-card p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">What you get</h2>
            <ul className="mt-4 space-y-3">
              {features.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="text-2xl leading-none">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">How it works:</span> Create an
              account, add your staff & set their DA and salary, mark daily attendance, and the
              app auto-calculates payable salary and generates expense records. Export everything
              to Excel anytime.
            </div>
          </div>

          {/* Auth form */}
          <div className="rounded-3xl bg-card p-6 shadow-2xl">
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSignUp ? "Start tracking in minutes — free" : "Log in to continue"}
              </p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label="Show password"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Please wait..." : isSignUp ? "Create account" : "Log in"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "New here?"}{" "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                {isSignUp ? "Log in" : "Create account"}
              </button>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-primary-foreground/75">
          🔒 Your data stays private to your account. Works on phone & desktop.
        </p>
      </div>
    </div>
  );
}
