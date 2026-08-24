import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/lib/data";
import { money, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/len-den")({
  head: () => ({
    meta: [
      { title: "लेन-देन सूची – खर्च ट्रैकर" },
      { name: "description", content: "सभी खर्च और फंडिंग खोजें, संपादित करें या हटाएँ।" },
      { property: "og:title", content: "लेन-देन सूची – खर्च ट्रैकर" },
      { property: "og:description", content: "सभी लेन-देन एक जगह खोजें और प्रबंधित करें।" },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const qc = useQueryClient();
  const { data: txns = [], isLoading } = useTransactions();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return txns.filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (!q ||
          t.category.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          t.date.includes(q)),
    );
  }, [txns, search, type]);

  const totals = useMemo(() => {
    const expense = filtered
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    const income = filtered
      .filter((t) => t.type === "funding")
      .reduce((s, t) => s + Number(t.amount), 0);
    return { expense, income };
  }, [filtered]);

  const remove = async (id: string) => {
    if (!confirm("क्या आप इसे हटाना चाहते हैं?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    toast.success("हटा दिया गया");
  };

  return (
    <AppShell title="📝 लेन-देन सूची">
      <div className="flex gap-2">
        <Input
          placeholder="🔍 खोजें..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">सभी</option>
          <option value="expense">खर्च</option>
          <option value="funding">फंडिंग</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="खर्च" value={money(totals.expense)} tone="expense" />
        <Stat label="फंडिंग" value={money(totals.income)} tone="income" />
        <Stat label="बैलेंस" value={money(totals.income - totals.expense)} tone="balance" />
      </div>

      <div className="surface mt-4 divide-y">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">लोड हो रहा है...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">कोई लेन-देन नहीं मिला।</p>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.category}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hiDate(t.date)}
                {t.description ? ` • ${t.description}` : ""}
                {t.source === "attendance" ? " • हाज़िरी DA" : ""}
              </p>
            </div>
            <span
              className={`num text-sm font-bold ${
                t.type === "expense" ? "text-destructive" : "text-success"
              }`}
            >
              {t.type === "expense" ? "-" : "+"}
              {money(Number(t.amount))}
            </span>
            <Button asChild variant="ghost" size="icon" aria-label="संपादित करें">
              <Link to="/add" search={{ edit: t.id }}>
                <Pencil className="size-4" />
              </Link>
            </Button>
            <button onClick={() => remove(t.id)} aria-label="हटाएँ">
              <Trash2 className="size-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
