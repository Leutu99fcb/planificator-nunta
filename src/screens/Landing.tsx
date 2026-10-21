import { useState } from "react";
import { CalendarHeart, HandCoins, LayoutGrid, ListChecks, Lock, Users } from "lucide-react";
import { googleConfigured } from "../lib/config";
import { getStoredUser, signIn, type GoogleUser } from "../lib/google/auth";
import { useFeedback } from "../components/feedback";
import { Button, Card, Spinner } from "../components/ui";
import { ThemeButton } from "../components/ThemeButton";

const FEATURES = [
  { icon: Users, title: "Invitați", text: "RSVP, însoțitori, copii, restricții alimentare." },
  { icon: HandCoins, title: "Costuri și plăți", text: "Avansuri, rate și termene de plată pentru fiecare furnizor." },
  { icon: LayoutGrid, title: "Așezare la mese", text: "Tragi invitații la mese și vezi locurile libere." },
  { icon: ListChecks, title: "De rezolvat", text: "Lista de lucruri cu termene până la nuntă." },
];

export function Landing({ onDemo, onGoogle }: { onDemo: () => void; onGoogle: (u: GoogleUser) => void }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const remembered = getStoredUser();

  const login = async () => {
    setBusy(true);
    try {
      onGoogle(await signIn());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Login eșuat", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen px-4 py-10 sm:py-16">
      <div className="absolute right-3 top-3">
        <ThemeButton />
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg">
            <CalendarHeart className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Planificator de nuntă</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Invitați, costuri, plăți și așezare la mese, într-un singur loc. Gratuit, și pentru partenerul tău.
          </p>
        </div>

        <Card className="mx-auto mt-8 max-w-md p-6">
          {googleConfigured ? (
            <Button variant="primary" className="h-12 w-full text-base" onClick={login} disabled={busy}>
              {busy ? <Spinner /> : <GoogleIcon />}
              {remembered ? `Continuă ca ${remembered.email}` : "Continuă cu Google"}
            </Button>
          ) : (
            <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-ink">
              Login-ul Google nu e configurat încă pe acest site. Poți încerca aplicația în modul demo.
            </p>
          )}
          <Button className="mt-3 w-full" onClick={onDemo}>
            Încearcă fără cont (demo)
          </Button>

          <div className="mt-5 flex gap-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
            <p>
              Datele tale stau într-un Google Sheet din <b>Drive-ul tău</b>. Aplicația nu are server și nu are bază de date:
              nimeni altcineva nu le vede, nici autorul aplicației. Aplicația cere acces doar la fișierele create de ea.{" "}
              <a className="text-primary-ink underline" href="/confidentialitate.html">
                Confidențialitate
              </a>
            </p>
          </div>
        </Card>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title} className="flex gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">{f.title}</div>
                <div className="text-sm text-muted">{f.text}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 rounded-full bg-white p-0.5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
