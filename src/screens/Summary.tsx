import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { budgetSummary, guestStats, paymentState, seatingStats, sortTasks, taskBucket, upcomingPayments } from "../lib/calc";
import { daysUntil, formatDate, relativeDays } from "../lib/dates";
import { money, plural } from "../lib/format";
import { usePlanner } from "../state/planner";
import { href } from "../state/route";
import { Badge, Card, Progress, SectionTitle, Stat } from "../components/ui";

export function Summary() {
  const { data } = usePlanner();
  const cur = data.settings.moneda;
  const gs = guestStats(data.guests);
  const bs = budgetSummary(data);
  const ss = seatingStats(data);
  const payments = upcomingPayments(data, 30);
  const tasks = sortTasks(data.tasks).filter((t) => ["restante", "curand"].includes(taskBucket(t)));
  const days = daysUntil(data.settings.dataNunta);

  const alerts: { text: string; to: string }[] = [];
  if (bs.overBudget) alerts.push({ text: `Costurile depășesc bugetul cu ${money(bs.total - bs.budget, cur)}.`, to: href("costuri") });
  const overdue = payments.filter((p) => paymentState(p.payment) === "restant");
  if (overdue.length) alerts.push({ text: `${plural(overdue.length, "plată restantă", "plăți restante")}.`, to: href("costuri") });
  if (ss.overfull.length) alerts.push({ text: `${plural(ss.overfull.length, "masă are", "mese au")} mai mulți invitați decât locuri.`, to: href("mese") });
  const lateTasks = tasks.filter((t) => taskBucket(t) === "restante");
  if (lateTasks.length) alerts.push({ text: `${plural(lateTasks.length, "lucru", "lucruri")} de rezolvat cu termenul depășit.`, to: href("sarcini") });

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-primary-soft px-5 py-6 text-center">
          {days === null ? (
            <a href={href("setari")} className="text-primary-ink underline">Setează data nunții</a>
          ) : days >= 0 ? (
            <>
              <div className="font-serif text-5xl font-semibold text-primary-ink tabular-nums">{days}</div>
              <div className="mt-1 text-sm text-muted">{days === 1 ? "zi" : "zile"} până la nuntă · {formatDate(data.settings.dataNunta)}</div>
            </>
          ) : (
            <div className="font-serif text-xl text-primary-ink">Casă de piatră! 🎉</div>
          )}
          {(data.settings.locatiePetrecere || data.settings.locatieCeremonie) && (
            <div className="mt-2 text-xs text-muted">
              {[data.settings.locatieCeremonie, data.settings.locatiePetrecere].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </Card>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <a key={a.text} href={a.to} className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning-ink hover:opacity-90">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.text}
            </a>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Persoane confirmate" value={gs.confirmed} sub={`din ${gs.total} invitate · ${gs.unknown} fără răspuns`} />
        <Stat label="Cost total" value={money(bs.total, cur)} sub={bs.budget ? `buget ${money(bs.budget, cur)}` : "buget nesetat"} tone={bs.overBudget ? "danger" : undefined} />
        <Stat label="Plătit" value={money(bs.paid, cur)} sub={`rest ${money(bs.remaining, cur)}`} tone="success" />
        <Stat label="Persoane așezate" value={`${ss.seatedPersons}/${ss.seats}`} sub={ss.unseatedPersons ? `${ss.unseatedPersons} persoane neașezate` : "toți sunt așezați"} />
      </div>

      {bs.budget > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>Buget folosit</span>
            <span className="tabular-nums text-muted">
              {money(bs.total, cur)} / {money(bs.budget, cur)}
            </span>
          </div>
          <Progress value={bs.total} max={bs.budget} tone={bs.overBudget ? "danger" : "primary"} />
          <div className="mt-2 text-xs text-muted">
            {bs.overBudget ? `Peste buget cu ${money(-bs.leftInBudget, cur)}` : `Mai ai ${money(bs.leftInBudget, cur)} disponibili în buget`}
            {bs.potential > 0 && ` · încă ${money(bs.potential, cur)} costuri potențiale în „De rezolvat”`}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle action={<a className="text-sm text-primary-ink" href={href("costuri")}>Toate costurile</a>}>Plăți în următoarele 30 de zile</SectionTitle>
          {payments.length === 0 ? (
            <Card className="flex items-center gap-2 p-4 text-sm text-muted">
              <CheckCircle2 className="h-4 w-4 text-success-ink" /> Nicio plată scadentă în perioada asta.
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {payments.map(({ payment: p, cost }) => {
                const st = paymentState(p);
                const d = daysUntil(p.scadenta)!;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <CalendarClock className={st === "restant" ? "h-4 w-4 text-danger-ink" : "h-4 w-4 text-muted"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{cost?.furnizor || cost?.categorie || "Cost șters"}</div>
                      <div className="text-xs text-muted">
                        {p.descriere} · {formatDate(p.scadenta)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{money(p.suma, p.moneda)}</div>
                      <Badge tone={st === "restant" ? "danger" : "warning"}>{relativeDays(d)}</Badge>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </section>

        <section>
          <SectionTitle action={<a className="text-sm text-primary-ink" href={href("sarcini")}>Toată lista</a>}>De rezolvat în curând</SectionTitle>
          {tasks.length === 0 ? (
            <Card className="flex items-center gap-2 p-4 text-sm text-muted">
              <CheckCircle2 className="h-4 w-4 text-success-ink" /> Nimic urgent în următoarele 30 de zile.
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {tasks.slice(0, 8).map((t) => {
                const d = daysUntil(t.termen)!;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.titlu}</div>
                      <div className="text-xs text-muted">{[t.categorie, t.responsabil].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Badge tone={d < 0 ? "danger" : "warning"}>{relativeDays(d)}</Badge>
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>

      <section>
        <SectionTitle>Invitați pe scurt</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Invitații (rânduri)" value={gs.rows} />
          <Stat label="Persoane estimate" value={gs.expected} sub="confirmate + fără răspuns" />
          <Stat label="Copii" value={gs.kids} />
          <Stat label="Cu restricții alimentare" value={gs.withRestrictions} />
        </div>
      </section>
    </div>
  );
}
