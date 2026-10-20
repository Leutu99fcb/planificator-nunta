import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileSpreadsheet, LogOut, Mail, RotateCcw, Shuffle, UserMinus } from "lucide-react";
import { DemoStore } from "../lib/demoStore";
import type { GoogleUser } from "../lib/google/auth";
import { listAccess, removeAccess, sharePlanner } from "../lib/google/setup";
import type { Moneda, Settings } from "../lib/types";
import { usePlanner } from "../state/planner";
import { useFeedback } from "../components/feedback";
import { Badge, Button, Card, Field, Input, SectionTitle, Select, Spinner } from "../components/ui";
import { Guide } from "./Guide";

export function SettingsPage({ user, onLeave, onSwitch }: { user?: GoogleUser; onLeave: () => void; onSwitch?: () => void }) {
  const { data, store, saveSettings } = usePlanner();
  const { confirm } = useFeedback();
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(data.settings);
  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Partial<Settings> = {};
    (Object.keys(form) as (keyof Settings)[]).forEach((k) => {
      if (form[k] !== data.settings[k]) (patch as Record<string, unknown>)[k] = form[k];
    });
    await saveSettings(patch, "Setări salvate");
  };

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Setări</h1>

      <section>
        <SectionTitle>Despre nuntă</SectionTitle>
        <Card className="p-5">
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Partener 1">
                <Input value={form.partener1} onChange={(e) => set("partener1", e.target.value)} />
              </Field>
              <Field label="Partener 2">
                <Input value={form.partener2} onChange={(e) => set("partener2", e.target.value)} />
              </Field>
              <Field label="Data nunții (petrecerea)">
                <Input type="date" value={form.dataNunta} onChange={(e) => set("dataNunta", e.target.value)} />
              </Field>
              <Field label="Data cununiei civile">
                <Input type="date" value={form.dataCivila} onChange={(e) => set("dataCivila", e.target.value)} />
              </Field>
              <Field label="Locația ceremoniei">
                <Input value={form.locatieCeremonie} onChange={(e) => set("locatieCeremonie", e.target.value)} placeholder="ex: Biserica Sf. Nicolae" />
              </Field>
              <Field label="Locația petrecerii">
                <Input value={form.locatiePetrecere} onChange={(e) => set("locatiePetrecere", e.target.value)} placeholder="ex: Restaurant Grădina" />
              </Field>
              <Field label="Moneda principală" hint="În ea se văd bugetul și totalurile. Fiecare cost poate fi în lei sau euro.">
                <Select value={form.moneda} onChange={(e) => set("moneda", e.target.value as Moneda)}>
                  <option value="RON">Lei (RON)</option>
                  <option value="EUR">Euro (EUR)</option>
                </Select>
              </Field>
              <Field label={`Buget total (${form.moneda === "EUR" ? "€" : "lei"})`}>
                <Input type="number" min={0} step="any" value={form.bugetTotal || ""} onChange={(e) => set("bugetTotal", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Curs euro: câți lei face 1 €" hint="Folosit la totaluri când amesteci lei și euro. Pune cursul BNR sau cel din contracte.">
                <Input type="number" min={0.01} step="0.0001" value={form.cursEur || ""} onChange={(e) => set("cursEur", Number(e.target.value) || 0)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!dirty}>
                Salvează
              </Button>
            </div>
          </form>
        </Card>
      </section>

      {store.kind === "google" && user ? (
        <>
          <Partner fileId={store.id} user={user} />
          <section>
            <SectionTitle>Planificatorul</SectionTitle>
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-3 text-sm">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">{store.title}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={store.url} target="_blank" rel="noreferrer">
                  <Button icon={<ExternalLink className="h-4 w-4" />}>Deschide în Google Sheets</Button>
                </a>
                {onSwitch && (
                  <Button icon={<Shuffle className="h-4 w-4" />} onClick={onSwitch}>
                    Schimbă planificatorul
                  </Button>
                )}
                <Button variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={onLeave}>
                  Deconectează-te ({user.email})
                </Button>
              </div>
              <p className="text-xs text-muted">
                Poți edita și direct în Sheet. Nu modifica antetele și coloanele gri (sunt formule); rândurile adăugate de mână primesc automat un ID.
              </p>
            </Card>
          </section>
        </>
      ) : (
        <section>
          <SectionTitle>Mod demo</SectionTitle>
          <Card className="space-y-3 p-5 text-sm">
            <p className="text-muted">
              Datele demo stau doar în acest browser. Ca să-ți salvezi planificatorul real și să-l împarți cu partenerul, ieși din demo și conectează-te cu Google.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={async () => {
                  if (await confirm({ title: "Resetezi datele demo?", text: "Revii la exemplul de la început.", confirmLabel: "Resetează" })) {
                    DemoStore.reset();
                    await qc.invalidateQueries();
                    setForm((await store.load()).settings);
                  }
                }}
              >
                Resetează datele demo
              </Button>
              <Button variant="primary" icon={<LogOut className="h-4 w-4" />} onClick={onLeave}>
                Ieși din demo
              </Button>
            </div>
          </Card>
        </section>
      )}

      <Guide />
    </div>
  );
}

function Partner({ fileId, user }: { fileId: string; user: GoogleUser }) {
  const { toast, confirm } = useFeedback();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const access = useQuery({ queryKey: ["access", fileId], queryFn: () => listAccess(fileId) });
  const people = (access.data ?? []).filter((p) => p.type === "user");
  const iAmOwner = people.some((p) => p.role === "owner" && p.emailAddress?.toLowerCase() === user.email.toLowerCase());

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await sharePlanner(fileId, email, user.name || user.email);
      toast(`${email} poate edita acum planificatorul. A primit un email de la Google.`);
      setEmail("");
      access.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Invitația a eșuat", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>Partener și acces</SectionTitle>
      <Card className="space-y-4 p-5">
        <form onSubmit={invite} className="space-y-2">
          <Field label="Invită partenerul (contul lui Google)" hint="Primește acces de Editor doar la acest Sheet, ca la un Share obișnuit din Drive.">
            <div className="flex gap-2">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partener@gmail.com" />
              <Button type="submit" variant="primary" disabled={busy} icon={busy ? <Spinner /> : <Mail className="h-4 w-4" />}>
                Invită
              </Button>
            </div>
          </Field>
        </form>
        <div>
          <div className="mb-2 text-sm font-medium">Cine are acces</div>
          {access.isPending ? (
            <Spinner />
          ) : access.isError ? (
            <p className="text-sm text-muted">Nu am putut citi lista de acces.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.displayName || p.emailAddress}</span>
                  <Badge tone={p.role === "owner" ? "primary" : "neutral"}>{p.role === "owner" ? "proprietar" : p.role === "writer" ? "editor" : "citire"}</Badge>
                  {iAmOwner && p.role !== "owner" && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted hover:bg-surface-2"
                      aria-label="Elimină accesul"
                      onClick={async () => {
                        if (!(await confirm({ title: "Elimini accesul?", text: `${p.emailAddress} nu va mai putea vedea planificatorul.`, confirmLabel: "Elimină", danger: true }))) return;
                        try {
                          await removeAccess(fileId, p.id);
                          access.refetch();
                        } catch (err) {
                          toast(err instanceof Error ? err.message : "Eroare", "error");
                        }
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
