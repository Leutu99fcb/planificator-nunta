import type { Route } from "../state/route";
import { aria, button, field, withText, type Guide, type Target } from "./driver";

// Scenariile ghidurilor: ce apasă „degetul” pe fiecare pagină reală și ce text apare.
// Rulează pe datele demo (Ana & Mihai), în memorie. Fiecare durează cam 20 de secunde.
// `steps` = numărul de apeluri `say`, pentru bara de progres.

export interface GuideScript {
  title: string;
  steps: number;
  run: (g: Guide) => Promise<void>;
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Elementul planului (masa, scena) după nume. */
const tableBody = (name: string): Target => () =>
  [...document.querySelectorAll("[data-board] span")].find((s) => norm(s.textContent).startsWith(name))?.closest<HTMLElement>(".absolute");

/** Al n-lea loc liber al unei mese. */
const freeSeat = (name: string, n = 0): Target => () => {
  const body = (tableBody(name) as () => HTMLElement | null | undefined)();
  return body?.parentElement?.querySelectorAll('button[aria-label^="Loc liber"]')[n];
};

/** Un buton din rândul invitatului `name` (ex: „Da” la RSVP). */
const guestRowButton = (name: string, text: string): Target => () => {
  const edit = document.querySelector(`[aria-label="Editează ${name}"]`);
  return [...(edit?.parentElement?.querySelectorAll("button") ?? [])].find((b) => norm(b.textContent) === text);
};

/** Un buton din cardul furnizorului `name` (pagina Costuri). */
const costCardButton = (name: string, text: string): Target => () => {
  const title = [...document.querySelectorAll("main span.font-medium")].find((s) => norm(s.textContent) === name);
  const card = title?.closest(".rounded-xl");
  return [...(card?.querySelectorAll("button") ?? [])].find((b) => norm(b.textContent).startsWith(text));
};

const costCardCheckbox = (name: string): Target => () => {
  const title = [...document.querySelectorAll("main span.font-medium")].find((s) => norm(s.textContent) === name);
  return title?.closest(".rounded-xl")?.querySelector('input[type="checkbox"]');
};

const heading = (text: string): Target => withText("main h2, main h1", text);

export const SCRIPTS: Record<Route, GuideScript> = {
  rezumat: {
    title: "Rezumat",
    steps: 7,
    async run(g) {
      await g.say("Rezumatul arată, dintr-o privire, cum stai cu pregătirile.");
      await g.point(withText("main div", "zile până la nuntă"));
      await g.wait(1600);
      await g.say("Alertele îți spun ce e urgent: plăți restante, mese prea pline, termene depășite.");
      await g.point(withText("main a", "restant"));
      await g.wait(1800);
      await g.say("Confirmări, cost total, cât ai plătit și câți invitați au loc la masă.");
      await g.point(withText("main .text-xs.uppercase", "Cost total"));
      await g.wait(1800);
      await g.say("Bara de buget arată cât ai cheltuit și cât îți mai rămâne.");
      await g.point(withText("main span", "Buget folosit"));
      await g.wait(1800);
      await g.say("Plățile din următoarele 30 de zile, cu suma și termenul fiecăreia.");
      await g.point(heading("Plăți în următoarele"));
      await g.wait(1800);
      await g.say("Și lucrurile de rezolvat în curând, cu termenul lor.");
      await g.point(heading("De rezolvat în curând"));
      await g.wait(1800);
      await g.say("Atingi o alertă și ajungi direct pe pagina potrivită.");
      await g.tap(withText("main a", "restant"));
      await g.wait(2200);
    },
  },

  invitati: {
    title: "Invitați",
    steps: 8,
    async run(g) {
      await g.say("Invitații sunt grupați pe familii și prieteni, cu cine vine și cine nu.");
      await g.point(withText("main p", "persoane"));
      await g.wait(1500);
      await g.say("Adaugi un invitat: nume, grup, partea mirelui sau a miresei…");
      await g.tap(button("Adaugă invitat"));
      await g.type(field("Nume"), "Bogdan Iliescu");
      await g.type(field("Grup / familie"), "Colegi");
      await g.say("…câți însoțitori și copii vin cu el și restricțiile alimentare.");
      await g.set(field("Însoțitori"), "1");
      await g.type(field("Restricții"), "vegetarian");
      await g.wait(600);
      await g.say("Salvezi și apare imediat în listă.");
      await g.tap(button("Salvează", true));
      await g.wait(1200);
      await g.say("Cu „Mai mulți” lipești o listă întreagă dintr-odată, câte un nume pe rând.");
      await g.tap(button("Mai mulți"));
      await g.type(field("Câte un nume pe linie"), "Diana Pop\nRobert Ene\nSara Mihai", 40);
      await g.set(field("Grup (pentru toți)") , "Prieteni");
      await g.tap(button("Adaugă 3", true));
      await g.wait(1000);
      await g.say("Bifezi direct din listă cine a confirmat: Da, Nu sau „?”.");
      await g.tap(guestRowButton("Andrei Vasile", "Da"));
      await g.wait(1200);
      await g.say("Cauți pe cineva sau filtrezi după răspuns și după parte.");
      await g.type("main input[placeholder^='Caută']", "Popescu", 70);
      await g.wait(1600);
      await g.say("Apeși pe un nume ca să-l editezi, să-i alegi masa sau să-l ștergi.");
      await g.point(aria("Editează Elena Popescu"));
      await g.wait(1600);
    },
  },

  costuri: {
    title: "Costuri",
    steps: 8,
    async run(g) {
      await g.say("La Costuri vezi totalul, cât ai plătit, ce mai ai de plătit și bugetul.");
      await g.point(withText("main .text-xs.uppercase", "Cost total"));
      await g.wait(1500);
      await g.say("Adaugi un furnizor, cu prețul în lei sau în euro.");
      await g.tap(button("Adaugă cost"));
      await g.type(field("Categorie"), "Tort");
      await g.type(field("Furnizor"), "Cofetăria Dulce");
      await g.tap(button("€ EUR", true));
      await g.type(field("Cost estimat"), "600");
      await g.say("Salvezi, iar furnizorul apare cu totalul lui.");
      await g.tap(button("Salvează", true));
      await g.wait(1000);
      await g.say("Programezi avansul și restul, fiecare cu suma și termenul de plată.");
      await g.tap(costCardButton("Cofetăria Dulce", "Adaugă plată"));
      await g.type(field("Sumă"), "200");
      await g.set(field("Termen de plată"), new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10));
      await g.tap(button("Salvează", true));
      await g.wait(800);
      await g.say("Când plătești, bifezi. Plătitul și restul se recalculează singure.");
      await g.tap(costCardCheckbox("Cofetăria Dulce"));
      await g.wait(1400);
      await g.say("Calendarul arată toate plățile rămase, în ordinea termenelor. Restanțele apar cu roșu.");
      await g.point(heading("Calendar plăți"));
      await g.wait(2000);
      await g.say("Vezi și costurile estimate din „De rezolvat”, care nu intră încă în total.");
      await g.point(withText("main a", "costuri potențiale"));
      await g.wait(1800);
      await g.say("Și vezi pe ce se duc banii, pe categorii.");
      await g.point(heading("Pe categorii"));
      await g.wait(2000);
    },
  },

  mese: {
    title: "Mese",
    steps: 9,
    async run(g) {
      await g.say("Planul sălii: mesele, masa mirilor, scena, ringul de dans și cine unde stă.");
      await g.point("[data-board]", false);
      await g.wait(1400);
      await g.say("Alegi ce scrie pe locuri: inițiale, prenume sau numele întreg.");
      await g.tap(button("Nume întreg"));
      await g.wait(1000);
      await g.say("Atingi un invitat din „Neașezați”…");
      await g.tap(withText("main button", "Cristina Dobre"));
      await g.wait(500);
      await g.say("…apoi locul lui. Însoțitorii stau automat pe locurile de lângă.");
      await g.tap(freeSeat("Masa 3"));
      await g.wait(1300);
      await g.say("Atingi o masă și vezi cine stă acolo. Poți adăuga sau scoate invitați.");
      await g.tap(tableBody("Masa 1"));
      await g.wait(1800);
      await g.tap(aria("Închide"));
      await g.say("În „Aranjează sala” muți mesele trăgându-le, le rotești și le mărești.");
      await g.tap(button("Aranjează sala"));
      await g.tap(tableBody("Masa 2"), { pointer: true });
      await g.wait(400);
      await g.say("Selectezi o masă și o rotești, pas cu pas sau de butonul rotund de deasupra.");
      await g.tap(aria("Rotește la dreapta 15°"));
      await g.tap(aria("Rotește la dreapta 15°"), { scroll: false });
      await g.tap(aria("Rotește la dreapta 15°"), { scroll: false });
      await g.say("Schimbi numărul de locuri sau o editezi: nume, formă, dimensiuni.");
      await g.tap(aria("Un loc în plus"));
      await g.wait(800);
      await g.say("Din „Adaugă” pui mese rotunde, pătrate, dreptunghiulare, scenă sau ring de dans.");
      await g.tap(button("Adaugă"));
      await g.wait(1600);
      await g.tap(button("Masă rotundă"));
      await g.wait(1200);
    },
  },

  sarcini: {
    title: "De rezolvat",
    steps: 6,
    async run(g) {
      await g.say("Aici ții tot ce mai e de făcut până la nuntă.");
      await g.point(withText("main p", "rămase"));
      await g.wait(1400);
      await g.say("Pornești de la o listă sugerată, cu termene calculate din data nunții.");
      await g.tap(button("Listă sugerată"));
      await g.wait(900);
      await g.tap(button("Adaugă", true));
      await g.wait(1400);
      await g.say("Restanțele apar primele, apoi ce urmează în 30 de zile și ce e mai târziu.");
      await g.point(withText("main section button", "Termen depășit"));
      await g.wait(1800);
      await g.say("Deschizi o sarcină: termen, responsabil și un cost estimat, dacă vrei.");
      await g.tap(withText("main section button", "Alegem fotobooth"));
      await g.wait(1600);
      await g.say("Când te hotărăști, o transformi în cost, iar suma intră în buget.");
      await g.tap(button("Transformă în cost", true));
      await g.wait(1200);
      await g.tap(button("Salvează", true));
      await g.wait(1000);
      await g.say("Bifezi ce ai rezolvat.");
      await g.tap(aria("Marchează „Degustare meniu la restaurant” ca rezolvat"));
      await g.wait(1800);
    },
  },

  setari: {
    title: "Setări",
    steps: 6,
    async run(g) {
      await g.say("Alegi tema: luminoasă, întunecată sau ca telefonul.");
      await g.point(withText("main button", "Întunecat"));
      await g.wait(1600);
      await g.say("Completezi numele, data nunții și locațiile.");
      await g.point(field("Data nunții"));
      await g.wait(1600);
      await g.say("Bugetul, moneda principală și cursul euro, pentru totaluri corecte.");
      await g.set(field("Buget total"), "130000");
      await g.wait(500);
      await g.tap(button("Salvează"));
      await g.wait(1200);
      await g.say("Cu contul Google, tot aici îți inviți partenerul ca să lucrați împreună.");
      await g.tap(withText("main summary", "Cum lucrăm amândoi"));
      await g.wait(2400);
      await g.say("Ghidul rapid răspunde la întrebările obișnuite.");
      await g.point(heading("Ghid rapid"));
      await g.wait(1800);
      await g.say("Și oricând apeși „Cum funcționează” sus, pe orice pagină.");
      g.hide();
      await g.wait(2000);
    },
  },
};
