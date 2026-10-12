import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions, currentUserId, type Txn } from "@/lib/data";
import { deleteTransactionOffline } from "@/lib/offline";
import { money, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/len-den")({
  head: () => ({
    meta: [
      { title: "Transactions – Expense Tracker" },
      { name: "description", content: "Search, edit or delete all your expense and funding entries." },
      { property: "og:title", content: "Transactions – Expense Tracker" },
      { property: "og:description", content: "Find and manage every transaction in one place." },
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
    if (!confirm("Delete this transaction?")) return;
    try {
      const userId = await currentUserId();
      const result = await deleteTransactionOffline(userId, id);
      qc.setQueryData<Txn[]>(["transactions"], (current = []) =>
        current.filter((transaction) => transaction.id !== id),
      );
      if (!result.queued) qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(result.queued ? "Deleted on this device; removal will sync when online." : "Deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <AppShell title="📝 Transactions">
      <div className="flex gap-2">
        <Input
          placeholder="🔍 Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="expense">Expense</option>
          <option value="funding">Funding</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Expenses" value={money(totals.expense)} tone="expense" />
        <Stat label="Funding" value={money(totals.income)} tone="income" />
        <Stat label="Balance" value={money(totals.income - totals.expense)} tone="balance" />
      </div>

      <div className="surface mt-4 divide-y">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No transactions found.</p>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.category}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hiDate(t.date)}
                {t.description ? ` • ${t.description}` : ""}
                {t.source === "attendance" ? " • Attendance DA" : ""}
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
            <Button asChild variant="ghost" size="icon" aria-label="Edit">
              <Link to="/add" search={{ edit: t.id }}>
                <Pencil className="size-4" />
              </Link>
            </Button>
            <button onClick={() => remove(t.id)} aria-label="Delete">
              <Trash2 className="size-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
