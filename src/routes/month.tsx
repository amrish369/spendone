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
      { title: "मासिक सारांश – खर्च ट्रैकर" },
      { name: "description", content: "हर महीने का खर्च, फंडिंग और बैलेंस, तारीख अनुसार विवरण।" },
      { property: "og:title", content: "मासिक सारांश – खर्च ट्रैकर" },
      { property: "og:description", content: "महीने और तारीख अनुसार खर्च का सारांश।" },
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
    <AppShell title="📅 मासिक सारांश">
      <div className="space-y-3">
        {months.length === 0 && <p className="text-sm text-muted-foreground">कोई डेटा नहीं।</p>}
        {months.map(([key, v]) => (
          <div key={key} className="surface p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{monthLabel(key)}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {v.count} एंट्री
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">खर्च</p>
                <p className="num font-semibold text-destructive">{money(v.expense)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">फंडिंग</p>
                <p className="num font-semibold text-success">{money(v.income)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">बैलेंस</p>
                <p className="num font-semibold text-primary">{money(v.income - v.expense)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-6 mb-2 text-base font-semibold">📆 किसी तारीख के लेन-देन देखें</h3>
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          className="max-w-44"
          value={pickedDate}
          onChange={(e) => setPickedDate(e.target.value)}
        />
        <Button onClick={() => setActiveDate(pickedDate)}>दिखाएँ</Button>
        <Button
          variant="outline"
          onClick={() => {
            setPickedDate("");
            setActiveDate("");
          }}
        >
          साफ़ करें
        </Button>
      </div>

      {activeDate && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="खर्च" value={money(dateExpense)} tone="expense" />
            <Stat label="फंडिंग" value={money(dateIncome)} tone="income" />
            <Stat label="बैलेंस" value={money(dateIncome - dateExpense)} tone="balance" />
          </div>
          <div className="surface mt-3 divide-y">
            {dateList.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                {hiDate(activeDate)} को कोई लेन-देन नहीं।
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
