import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useTransactions } from "@/lib/data";
import { money, hiDate } from "@/lib/format";

export const Route = createFileRoute("/category")({
  head: () => ({
    meta: [
      { title: "By Category – Expense Tracker" },
      { name: "description", content: "See total expenses, funding and net balance for each category." },
      { property: "og:title", content: "By Category – Expense Tracker" },
      { property: "og:description", content: "A full breakdown of spending by category." },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { data: txns = [], isLoading } = useTransactions();
  const [selected, setSelected] = useState("all");

  const categories = useMemo(
    () => [...new Set(txns.map((t) => t.category))].sort(),
    [txns],
  );

  const summary = useMemo(() => {
    const map = new Map<
      string,
      { expense: number; income: number; count: number }
    >();
    txns.forEach((t) => {
      const cur = map.get(t.category) ?? { expense: 0, income: 0, count: 0 };
      if (t.type === "expense") cur.expense += Number(t.amount);
      else cur.income += Number(t.amount);
      cur.count += 1;
      map.set(t.category, cur);
    });
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v, net: v.income - v.expense }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [txns]);

  const shown = selected === "all" ? summary : summary.filter((s) => s.name === selected);
  const list = selected === "all" ? [] : txns.filter((t) => t.category === selected);

  return (
    <AppShell title="📈 By Category">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">📊 Category summary</h2>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-10 min-w-40 rounded-full border border-input bg-background px-3 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}
        {shown.map((c) => (
          <div key={c.name} className="surface p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{c.name}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {c.count} entries
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="num font-semibold text-destructive">{money(c.expense)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Funding</p>
                <p className="num font-semibold text-success">{money(c.income)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="num font-semibold text-primary">{money(c.net)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected !== "all" && (
        <>
          <h3 className="mt-6 mb-2 text-base font-semibold">Transactions in this category</h3>
          <div className="surface divide-y">
            {list.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No transactions.</p>
            )}
            {list.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm">{hiDate(t.date)}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <span
                  className={`num text-sm font-bold ${
                    t.type === "expense" ? "text-destructive" : "text-success"
                  }`}
                >
                  {t.type === "expense" ? "-" : "+"}
                  {money(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
