import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, Stat } from "@/components/AppShell";
import { useTransactions } from "@/lib/data";
import { money, monthKey, monthLabel, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/month")({
  head: () => ({
    meta: [
      { title: "Monthly Summary – Expense Tracker" },
      { name: "description", content: "Monthly expenses, funding and balance with day-wise details." },
      { property: "og:title", content: "Monthly Summary – Expense Tracker" },
      { property: "og:description", content: "Expense summary by month and date." },
    ],
  }),
  component: MonthPage,
});

function MonthPage() {
  const { data: txns = [] } = useTransactions();
  const [pickedDate, setPickedDate] = useState("");
  const [activeDate, setActiveDate] = useState("");

  const months = useMemo(() => {
    const map = new Map<string, { expense: number; income: number; count: number }>();
    txns.forEach((t) => {
      const k = monthKey(t.date);
      const cur = map.get(k) ?? { expense: 0, income: 0, count: 0 };
      if (t.type === "expense") cur.expense += Number(t.amount);
      else cur.income += Number(t.amount);
      cur.count += 1;
      map.set(k, cur);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [txns]);

  const dateList = txns.filter((t) => t.date === activeDate);
  const dateExpense = dateList
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const dateIncome = dateList
    .filter((t) => t.type === "funding")
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <AppShell title="📅 Monthly Summary">
      <div className="space-y-3">
        {months.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        {months.map(([key, v]) => (
          <div key={key} className="surface p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{monthLabel(key)}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {v.count} entries
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="num font-semibold text-destructive">{money(v.expense)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Funding</p>
                <p className="num font-semibold text-success">{money(v.income)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="num font-semibold text-primary">{money(v.income - v.expense)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-6 mb-2 text-base font-semibold">📆 View transactions for a date</h3>
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          className="max-w-44"
          value={pickedDate}
          onChange={(e) => setPickedDate(e.target.value)}
        />
        <Button onClick={() => setActiveDate(pickedDate)}>Show</Button>
        <Button
          variant="outline"
          onClick={() => {
            setPickedDate("");
            setActiveDate("");
          }}
        >
          Clear
        </Button>
      </div>

      {activeDate && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Expenses" value={money(dateExpense)} tone="expense" />
            <Stat label="Funding" value={money(dateIncome)} tone="income" />
            <Stat label="Balance" value={money(dateIncome - dateExpense)} tone="balance" />
          </div>
          <div className="surface mt-3 divide-y">
            {dateList.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                {hiDate(activeDate)} has no transactions.
              </p>
            )}
            {dateList.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{t.category}</p>
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
        </div>
      )}
    </AppShell>
  );
}
