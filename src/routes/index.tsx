import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, Stat } from "@/components/AppShell";
import { useTransactions } from "@/lib/data";
import { money, todayISO, hiDate, monthKey } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "डैशबोर्ड – खर्च ट्रैकर" },
      { name: "description", content: "आज का खर्च, फंडिंग, बैलेंस और हाल के लेन-देन एक जगह।" },
      { property: "og:title", content: "डैशबोर्ड – खर्च ट्रैकर" },
      { property: "og:description", content: "आज का खर्च, फंडिंग और हाल के लेन-देन देखें।" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: txns = [], isLoading } = useTransactions();
  const today = todayISO();

  const stats = useMemo(() => {
    const sum = (list: typeof txns, type: string) =>
      list.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
    const todayList = txns.filter((t) => t.date === today);
    const monthList = txns.filter((t) => monthKey(t.date) === monthKey(today));
    return {
      dayExpense: sum(todayList, "expense"),
      dayIncome: sum(todayList, "funding"),
      monthExpense: sum(monthList, "expense"),
      monthIncome: sum(monthList, "funding"),
      totalExpense: sum(txns, "expense"),
      totalIncome: sum(txns, "funding"),
    };
  }, [txns, today]);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    txns
      .filter((t) => t.type === "expense")
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [txns]);

  return (
    <AppShell title="💰 खर्च ट्रैकर">
      <section className="surface brand-gradient overflow-hidden p-5 text-primary-foreground">
        <p className="text-sm opacity-80">कुल बैलेंस</p>
        <p className="num text-4xl font-bold">
          {money(stats.totalIncome - stats.totalExpense)}
        </p>
        <div className="mt-3 flex gap-6 text-sm">
          <span>फंडिंग: {money(stats.totalIncome)}</span>
          <span>खर्च: {money(stats.totalExpense)}</span>
        </div>
      </section>

      <h2 className="mt-6 mb-2 text-base font-semibold">आज का सारांश ({hiDate(today)})</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="खर्च" value={money(stats.dayExpense)} tone="expense" />
        <Stat label="फंडिंग" value={money(stats.dayIncome)} tone="income" />
        <Stat label="बैलेंस" value={money(stats.dayIncome - stats.dayExpense)} tone="balance" />
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">इस महीने</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="खर्च" value={money(stats.monthExpense)} tone="expense" />
        <Stat label="फंडिंग" value={money(stats.monthIncome)} tone="income" />
        <Stat
          label="बैलेंस"
          value={money(stats.monthIncome - stats.monthExpense)}
          tone="balance"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button asChild size="lg">
          <Link to="/add">➕ लेन-देन जोड़ें</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to="/attendance">🧑‍🏭 हाज़िरी लगाएँ</Link>
        </Button>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">शीर्ष श्रेणियाँ (खर्च)</h2>
      <div className="surface divide-y">
        {topCategories.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">अभी कोई डेटा नहीं।</p>
        )}
        {topCategories.map(([cat, amt]) => (
          <div key={cat} className="flex items-center justify-between p-3">
            <span className="text-sm">{cat}</span>
            <span className="num text-sm font-semibold text-destructive">{money(amt)}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">हाल के लेन-देन</h2>
      <div className="surface divide-y">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">लोड हो रहा है...</p>}
        {!isLoading && txns.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">अभी कोई लेन-देन नहीं।</p>
        )}
        {txns.slice(0, 8).map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.category}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hiDate(t.date)}
                {t.description ? ` • ${t.description}` : ""}
              </p>
            </div>
            <span
              className={`num shrink-0 text-sm font-bold ${
                t.type === "expense" ? "text-destructive" : "text-success"
              }`}
            >
              {t.type === "expense" ? "-" : "+"}
              {money(Number(t.amount))}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-center">
        <Button asChild variant="outline">
          <Link to="/len-den">सभी लेन-देन देखें</Link>
        </Button>
      </div>
    </AppShell>
  );
}
