import { useEffect, useState } from "react";

export const ROUTES = ["rezumat", "invitati", "costuri", "mese", "sarcini", "setari"] as const;
export type Route = (typeof ROUTES)[number];

function current(): Route {
  const r = window.location.hash.replace(/^#\/?/, "").split("?")[0] as Route;
  return ROUTES.includes(r) ? r : "rezumat";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(current);
  useEffect(() => {
    const on = () => {
      setRoute(current());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const href = (r: Route) => `#/${r}`;
