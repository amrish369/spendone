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
      { title: "लॉगिन – खर्च ट्रैकर" },
      { name: "description", content: "अपने खर्च, हाज़िरी और DA हिसाब के लिए लॉगिन करें।" },
      { property: "og:title", content: "लॉगिन – खर्च ट्रैकर" },
      { property: "og:description", content: "अपने खर्च और हाज़िरी खाते में साइन इन करें।" },
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
        toast.success("अकाउंट बन गया!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("स्वागत है!");
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "त्रुटि हुई");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="brand-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
        <div className="text-center">
          <p className="text-4xl">💰</p>
          <h1 className="mt-2 text-2xl font-bold">खर्च ट्रैकर</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp ? "नया अकाउंट बनाएं" : "लॉगिन करें"}
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="name">आपका नाम</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="आपका नाम"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">ईमेल</Label>
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
            <Label htmlFor="password">पासवर्ड</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="पासवर्ड"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="पासवर्ड दिखाएँ"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "रुकिए..." : isSignUp ? "अकाउंट बनाएं" : "लॉगिन"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isSignUp ? "पहले से अकाउंट है?" : "नया यूज़र हैं?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {isSignUp ? "लॉगिन करें" : "अकाउंट बनाएं"}
          </button>
        </p>
      </div>
    </div>
  );
}
