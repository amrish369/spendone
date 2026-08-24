import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useTransactions, currentUserId } from "@/lib/data";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/add")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search["edit"] === "string" ? { edit: search["edit"] } : {},
  head: () => ({
    meta: [
      { title: "लेन-देन जोड़ें – खर्च ट्रैकर" },
      { name: "description", content: "नया खर्च या फंडिंग जोड़ें और श्रेणियाँ प्रबंधित करें।" },
      { property: "og:title", content: "लेन-देन जोड़ें – खर्च ट्रैकर" },
      { property: "og:description", content: "नया खर्च या फंडिंग एंट्री बनाएं।" },
    ],
  }),
  component: AddPage,
});

function AddPage() {
  const navigate = useNavigate();
  const { edit } = useSearch({ from: "/add" });
  const qc = useQueryClient();
  const { data: txns = [] } = useTransactions();
  const { data: customCats = [] } = useCategories();

  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!edit) return;
    const t = txns.find((x) => x.id === edit);
    if (t) {
      setDate(t.date);
      setCategory(t.category);
      setAmount(String(t.amount));
      setDescription(t.description ?? "");
    }
  }, [edit, txns]);

  const save = async (type: "expense" | "funding") => {
    if (!category || !amount) {
      toast.error("श्रेणी और राशि ज़रूरी है!");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        date,
        category,
        amount: Number(amount),
        description: description || null,
        type,
      };
      if (edit) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", edit);
        if (error) throw error;
        toast.success("अपडेट हो गया!");
      } else {
        const user_id = await currentUserId();
        const { error } = await supabase.from("transactions").insert({ ...payload, user_id });
        if (error) throw error;
        toast.success("जुड़ गया!");
      }
      qc.invalidateQueries({ queryKey: ["transactions"] });
      if (edit) navigate({ to: "/len-den" });
      else {
        setAmount("");
        setDescription("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "त्रुटि");
    } finally {
      setBusy(false);
    }
  };

  const isEditingFunding = edit
    ? txns.find((t) => t.id === edit)?.type === "funding"
    : false;

  return (
    <AppShell title={edit ? "✏️ लेन-देन संपादित करें" : "➕ लेन-देन जोड़ें"}>
      <div className="surface space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">तारीख</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="category">श्रेणी</Label>
            <CategoryManager />
          </div>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">श्रेणी चुनें</option>
            <optgroup label="💰 डिफ़ॉल्ट खर्च">
              {DEFAULT_CATEGORIES.expense.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            {customCats.filter((c) => c.type === "expense").length > 0 && (
              <optgroup label="⭐ कस्टम खर्च">
                {customCats
                  .filter((c) => c.type === "expense")
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label="💵 डिफ़ॉल्ट फंडिंग">
              {DEFAULT_CATEGORIES.funding.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            {customCats.filter((c) => c.type === "funding").length > 0 && (
              <optgroup label="⭐ कस्टम फंडिंग">
                {customCats
                  .filter((c) => c.type === "funding")
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">राशि (₹)</Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">विवरण (वैकल्पिक)</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="विवरण लिखें..."
            rows={2}
          />
        </div>

        {edit ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              disabled={busy}
              onClick={() => save(isEditingFunding ? "funding" : "expense")}
            >
              अपडेट करें
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/len-den" })}>
              रद्द करें
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button disabled={busy} variant="destructive" onClick={() => save("expense")}>
              💸 खर्च जोड़ें
            </Button>
            <Button
              disabled={busy}
              onClick={() => save("funding")}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              💰 फंडिंग जोड़ें
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CategoryManager() {
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories();
  const [type, setType] = useState<"expense" | "funding">("expense");
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("categories")
      .insert({ name: name.trim(), type, user_id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    qc.invalidateQueries({ queryKey: ["categories"] });
    toast.success("श्रेणी जुड़ गई!");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          🏷️ श्रेणी प्रबंधन
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>श्रेणी प्रबंधन</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={type === "expense" ? "default" : "outline"}
            onClick={() => setType("expense")}
          >
            खर्च
          </Button>
          <Button
            variant={type === "funding" ? "default" : "outline"}
            onClick={() => setType("funding")}
          >
            फंडिंग
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="नई श्रेणी का नाम"
          />
          <Button onClick={add}>जोड़ें</Button>
        </div>
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {cats.filter((c) => c.type === type).length === 0 && (
            <p className="text-sm text-muted-foreground">कोई कस्टम श्रेणी नहीं।</p>
          )}
          {cats
            .filter((c) => c.type === type)
            .map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm">{c.name}</span>
                <button onClick={() => remove(c.id)} aria-label="हटाएँ">
                  <Trash2 className="size-4 text-destructive" />
                </button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
