import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DemoStore } from "./lib/demoStore";
import { getStoredUser, hasValidToken, signOut, type GoogleUser } from "./lib/google/auth";
import { GoogleSheetStore } from "./lib/google/sheetStore";
import type { PlannerStore } from "./lib/store";
import { PlannerProvider, usePlannerQuery } from "./state/planner";
import { Landing } from "./screens/Landing";
import { Chooser } from "./screens/Chooser";
import { Shell } from "./screens/Shell";
import { Button, Card, Spinner } from "./components/ui";
import { ReauthBanner } from "./components/ReauthBanner";
import { GUIDE_SCENE } from "./guide/runtime";
import { GuideApp } from "./guide/GuideApp";

// Sesiunea: demo (localStorage) sau Google (Sheet din Drive). Alegerea și ultimul
// planificator deschis se țin minte în browser, ca la revenire să intri direct.

const MODE_KEY = "pn_mode";
const plannerKey = (email: string) => `pn_planner:${email}`;

type Session = { mode: "landing" } | { mode: "demo" } | { mode: "google"; user: GoogleUser };

function initialSession(): Session {
  const mode = localStorage.getItem(MODE_KEY);
  if (mode === "demo") return { mode: "demo" };
  const user = getStoredUser();
  if (mode === "google" && user && hasValidToken()) return { mode: "google", user };
  return { mode: "landing" };
}

export function App() {
  // în iframe-ul ghidurilor rulează aplicația pe date demo din memorie, cu scenariul paginii
  return GUIDE_SCENE ? <GuideApp scene={GUIDE_SCENE} /> : <MainApp />;
}

function MainApp() {
  const [session, setSession] = useState<Session>(initialSession);

  const leave = () => {
    if (session.mode === "google") signOut();
    localStorage.removeItem(MODE_KEY);
    setSession({ mode: "landing" });
  };

  if (session.mode === "landing") {
    return (
      <Landing
        onDemo={() => {
          localStorage.setItem(MODE_KEY, "demo");
          setSession({ mode: "demo" });
        }}
        onGoogle={(user) => {
          localStorage.setItem(MODE_KEY, "google");
          setSession({ mode: "google", user });
        }}
      />
    );
  }
  if (session.mode === "demo") return <DemoSession onLeave={leave} />;
  return <GoogleSession user={session.user} onLeave={leave} />;
}

function DemoSession({ onLeave }: { onLeave: () => void }) {
  const store = useMemo(() => new DemoStore(), []);
  return <Planner store={store} onLeave={onLeave} />;
}

function GoogleSession({ user, onLeave }: { user: GoogleUser; onLeave: () => void }) {
  const [plannerId, setPlannerId] = useState<string | null>(() => localStorage.getItem(plannerKey(user.email)));

  const choose = (id: string | null) => {
    if (id) localStorage.setItem(plannerKey(user.email), id);
    else localStorage.removeItem(plannerKey(user.email));
    setPlannerId(id);
  };

  const storeQuery = useQuery({
    queryKey: ["store", plannerId],
    queryFn: () => GoogleSheetStore.open(plannerId!),
    enabled: !!plannerId,
    retry: false,
    staleTime: Infinity,
  });

  let content: React.ReactNode;
  if (!plannerId) content = <Chooser user={user} onOpen={choose} onLeave={onLeave} />;
  else if (storeQuery.isPending) content = <FullPageLoader text="Deschid planificatorul…" />;
  else if (storeQuery.isError) {
    content = (
      <ErrorPage
        text={storeQuery.error.message}
        action={<Button variant="primary" onClick={() => choose(null)}>Alege alt planificator</Button>}
      />
    );
  } else content = <Planner store={storeQuery.data} user={user} onLeave={onLeave} onSwitch={() => choose(null)} />;

  return (
    <>
      <ReauthBanner />
      {content}
    </>
  );
}

function Planner({ store, user, onLeave, onSwitch }: { store: PlannerStore; user?: GoogleUser; onLeave: () => void; onSwitch?: () => void }) {
  const q = usePlannerQuery(store);
  if (q.isPending) return <FullPageLoader text="Încarc datele…" />;
  if (q.isError && !q.data) {
    return (
      <ErrorPage
        text={q.error.message}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => q.refetch()}>Încearcă din nou</Button>
            {onSwitch && <Button onClick={onSwitch}>Alege alt planificator</Button>}
          </div>
        }
      />
    );
  }
  return (
    <PlannerProvider store={store} data={q.data!} fetching={q.isFetching}>
      <Shell user={user} onLeave={onLeave} onSwitch={onSwitch} />
    </PlannerProvider>
  );
}

export function FullPageLoader({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-muted">
      <Spinner />
      {text}
    </div>
  );
}

function ErrorPage({ text, action }: { text: string; action: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md p-6 text-center">
        <p className="mb-4 text-sm">{text}</p>
        {action}
      </Card>
    </div>
  );
}
