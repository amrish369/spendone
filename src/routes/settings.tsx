import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, currentUserId, type Staff } from "@/lib/data";
import { STAFF_ROLES, categoryForRole } from "@/lib/constants";
import { money } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "सेटिंग्स – स्टाफ और DA – खर्च ट्रैकर" },
      { name: "description", content: "हर स्टाफ के लिए दैनिक भत्ता (DA) राशि सेट करें।" },
      { property: "og:title", content: "सेटिंग्स – स्टाफ और DA" },
      { property: "og:description", content: "स्टाफ जोड़ें और उनका DA मूल्य तय करें।" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff = [] } = useStaff();
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Supervisor");
  const [da, setDa] = useState("");
  const [bulkDa, setBulkDa] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff"] });

  const addStaff = async () => {
    if (!name.trim()) {
      toast.error("नाम ज़रूरी है!");
      return;
    }
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("staff")
      .insert({ user_id, name: name.trim(), role, da_amount: Number(da) || 0 });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setDa("");
    refresh();
    toast.success("स्टाफ जुड़ गया!");
  };

  const update = async (id: string, patch: Partial<Staff>) => {
    const { error } = await supabase.from("staff").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("इस स्टाफ को हटाएँ? उनकी हाज़िरी भी हट जाएगी।")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("हटा दिया गया");
  };

  const applyBulk = async () => {
    const value = Number(bulkDa);
    if (!value) {
      toast.error("पहले DA राशि लिखें!");
      return;
    }
    const { error } = await supabase
      .from("staff")
      .update({ da_amount: value })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error(error.message);
      return;
    }
    setBulkDa("");
    refresh();
    toast.success("सभी स्टाफ का DA अपडेट हो गया!");
  };

  return (
    <AppShell title="⚙️ सेटिंग्स">
      <div className="surface p-4">
        <p className="text-sm text-muted-foreground">लॉगिन ईमेल</p>
        <p className="font-medium">{user?.email}</p>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">➕ नया स्टाफ जोड़ें</h2>
      <div className="surface space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="sname">नाम</Label>
          <Input
            id="sname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="जैसे: रमेश कुमार"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="srole">पद</Label>
            <select
              id="srole"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sda">DA राशि (₹/दिन)</Label>
            <Input
              id="sda"
              type="number"
              inputMode="decimal"
              value={da}
              onChange={(e) => setDa(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          हाज़िरी लगाते ही यह राशि "{categoryForRole(role)}" श्रेणी में खर्च के रूप में अपने आप जुड़
          जाएगी।
        </p>
        <Button onClick={addStaff} className="w-full">
          स्टाफ जोड़ें
        </Button>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">💵 सभी का DA एक साथ सेट करें</h2>
      <div className="surface flex gap-2 p-4">
        <Input
          type="number"
          value={bulkDa}
          onChange={(e) => setBulkDa(e.target.value)}
          placeholder="जैसे: 300"
        />
        <Button variant="secondary" onClick={applyBulk}>
          लागू करें
        </Button>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">👥 स्टाफ सूची</h2>
      <div className="space-y-3">
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground">अभी कोई स्टाफ नहीं।</p>
        )}
        {staff.map((s) => (
          <div key={s.id} className="surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.role} • वर्तमान DA {money(Number(s.da_amount))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.active}
                  onCheckedChange={(v) => update(s.id, { active: v })}
                  aria-label="सक्रिय"
                />
                <button onClick={() => remove(s.id)} aria-label="हटाएँ">
                  <Trash2 className="size-4 text-destructive" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">DA राशि</Label>
                <Input
                  type="number"
                  defaultValue={s.da_amount}
                  onBlur={(e) => {
                    const v = Number(e.target.value) || 0;
                    if (v !== Number(s.da_amount)) update(s.id, { da_amount: v });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">पद</Label>
                <select
                  value={s.role}
                  onChange={(e) => update(s.id, { role: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
