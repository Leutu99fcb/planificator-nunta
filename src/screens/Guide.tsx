import { SectionTitle, Card } from "../components/ui";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Unde stau datele?",
    a: "Într-un Google Sheet din Drive-ul celui care a creat planificatorul. Aplicația nu are server și nu are bază de date. Autorul ei nu vede nimic.",
  },
  {
    q: "Cum lucrăm amândoi?",
    a: "Din Setări > Partener, invită-l cu emailul lui Google. El intră în aplicație, se conectează și alege „Deschide planificator partajat”, o singură dată. Datele se reîncarcă automat cam o dată pe minut.",
  },
  {
    q: "Am modificat amândoi același lucru. Ce se întâmplă?",
    a: "Rămâne ultima salvare. Aplicația scrie doar rândul modificat, deci editările pe invitați sau costuri diferite nu se calcă între ele.",
  },
  {
    q: "Cum se calculează persoanele?",
    a: "Fiecare rând din Invitați înseamnă invitatul principal plus însoțitorii și copiii lui. Costurile „per persoană” (de exemplu meniul) se înmulțesc cu persoanele estimate: confirmate plus cele fără răspuns.",
  },
  {
    q: "Cum țin evidența avansurilor?",
    a: "La fiecare furnizor adaugi plățile: avans, tranșe, rest, fiecare cu sumă și termen. Când plătești, bifezi. Rezumatul arată ce e restant și ce urmează în 30 de zile.",
  },
  {
    q: "Am contracte în euro și în lei. Cum se adună?",
    a: "Fiecare cost și fiecare plată are moneda ei. Totalurile și bugetul se arată în moneda principală din Setări, la cursul pe care îl pui tot acolo. Dacă plătești în lei un contract în euro, plata se scade din contract la același curs.",
  },
  {
    q: "Ce e „cost potențial” la De rezolvat?",
    a: "O estimare opțională, de exemplu „fotobooth, cam 250 €”. Apare separat și nu intră în total. Când te hotărăști, deschizi sarcina și apeși „Transformă în cost”.",
  },
  {
    q: "Cum fac planul sălii?",
    a: "La Mese apasă „Adaugă” și pune mesele (rotunde, pătrate, dreptunghiulare), masa mirilor, scena, scena formației și ringul de dans. Le muți trăgându-le. Elementul selectat se mărește din colțul din dreapta-jos. Ca să muți mai multe deodată: pe calculator Shift sau Ctrl + clic, sau tragi un dreptunghi pe zona goală; pe telefon pornești „Selectează mai multe” și le atingi pe rând. Invitații din lista „Neașezați” îi tragi pe un scaun anume sau pe masă. Pe telefon ții apăsat puțin, apoi tragi.",
  },
  {
    q: "Pot lucra direct în Google Sheets?",
    a: "Da. Nu schimba antetele (primul rând) și nu scrie în coloanele gri, care sunt calculate. La rândurile adăugate de mână, aplicația pune singură ID-ul.",
  },
  {
    q: "Mi-a cerut din nou să mă conectez",
    a: "Accesul Google ține o oră, din motive de securitate. Apasă „Reconectează”. Nu pierzi nimic din ce era deja salvat.",
  },
];

export function Guide() {
  return (
    <section>
      <SectionTitle>Ghid rapid</SectionTitle>
      <Card className="divide-y divide-border">
        {ITEMS.map((i) => (
          <details key={i.q} className="group px-5 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
              <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
              {i.q}
            </summary>
            <p className="mt-2 pl-4 text-sm text-muted">{i.a}</p>
          </details>
        ))}
      </Card>
      <p className="mt-3 text-center text-xs text-muted">
        <a className="underline" href="/confidentialitate.html">Politica de confidențialitate</a>
      </p>
    </section>
  );
}
