# Planificator de nuntă

Aplicație web gratuită pentru planificarea nunții: **invitați**, **costuri și plăți** (avansuri, rate, termene), **așezare la mese** și **lucruri de rezolvat**. Datele stau într-un Google Sheet din Drive-ul utilizatorului. Aplicația nu are server și nu are bază de date, iar autorul ei nu vede datele nimănui.

## Cum funcționează

- Login cu Google (Google Identity Services, token client), cu permisiunea minimă `drive.file`.
- La prima folosire, aplicația creează un Sheet în Drive-ul utilizatorului, cu tab-urile Rezumat, Invitati, Costuri, Plati, Mese, Sarcini și Setari. Fiecare tab are antete, formule, dropdown-uri și formate.
- Citirile și scrierile merg direct din browser spre Sheets API v4 și Drive API v3.
- Partenerul este invitat din aplicație (Drive `permissions.create`, rol Editor). Apoi alege o singură dată Sheet-ul din Google Picker.
- Modul **demo** (fără cont) folosește localStorage, pentru încercare.

## Structura Sheet-ului

| Tab | Coloane scrise de aplicație | Coloane calculate (formule) |
|---|---|---|
| Invitati | ID, Nume, Grup, Partea, RSVP, Însoțitori, Copii, Restricții, Telefon, Masă (ID), Loc, Note | Persoane, Nume masă |
| Costuri | ID, Categorie, Furnizor, Contact, Tip cost (Fix / Per persoană), Monedă (RON/EUR), Estimat, Preț final, Status, Note | Total, Plătit, Rest (în moneda costului) |
| Plati | ID, Cost (ID), Descriere, Sumă, Monedă, Scadență, Plătit, Data plății, Note | Furnizor, Sumă în moneda costului |
| Mese | ID, Nume, Tip (Masă, Masa mirilor, Scenă, Scena formației, Ring de dans), Formă, Locuri, X, Y, Lățime, Înălțime, Note | Ocupate, Libere |
| Sarcini | ID, De rezolvat, Categorie, Termen, Responsabil, Status, Cost potențial, Monedă cost, Note | – |
| Setari | cheie / valoare (parteneri, date, locații, buget, moneda principală, curs EUR) | – |
| Rezumat | – | totaluri în moneda principală, persoane, buget, costuri potențiale, zile până la nuntă |

Fiecare cost și fiecare plată poate fi în lei sau euro. Totalurile și bugetul se calculează în moneda principală, la cursul din Setări. O plată în lei pentru un contract în euro se convertește la același curs.

Tab-ul Mese ține tot planul sălii. Coordonatele X/Y sunt colțul stânga-sus, în pixeli la zoom 100%. „Loc” din Invitati este primul scaun ocupat la masă, iar însoțitorii stau pe locurile următoare.

Regulile de calcul sunt aceleași în aplicație (`src/lib/calc.ts`) și în formulele din Sheet (`src/lib/schema.ts`). De exemplu, „persoane estimate” înseamnă confirmate plus fără răspuns, iar costurile „per persoană” se înmulțesc cu ele.

## Rulare locală

```bash
npm install
cp .env.example .env.local   # completează valorile Google (vezi mai jos)
npm run dev                  # http://localhost:5180
```

Fără `.env.local`, aplicația merge doar în modul demo.

## Configurare Google Cloud (o singură dată)

1. [console.cloud.google.com](https://console.cloud.google.com): creează un proiect nou, de exemplu „Planificator nunta”.
2. **APIs & Services → Library**: activează **Google Sheets API**, **Google Drive API** și **Google Picker API**.
3. **Google Auth Platform → Branding** (ecranul de consimțământ):
   - nume aplicație, email de suport, logo opțional;
   - domeniul autorizat: `vercel.app` sau domeniul tău;
   - link la politica de confidențialitate: `https://<domeniu>/confidentialitate.html`.
4. **Audience**: tip *External*, mod *Testing*. La *Test users* adaugă emailurile celor care o folosesc (maximum 100).
5. **Data Access**: adaugă scope-urile `openid`, `email`, `profile` și `.../auth/drive.file`.
6. **Clients → Create client → Web application**. La *Authorized JavaScript origins* pune `http://localhost:5180` și `https://<domeniu-vercel>`. Copiază **Client ID** în `VITE_GOOGLE_CLIENT_ID`.
7. **APIs & Services → Credentials → Create credentials → API key**. Restricționează cheia: *Website restrictions* cu `http://localhost:5180/*` și `https://<domeniu-vercel>/*`, iar la API restrictions doar **Google Picker API**. Copiaz-o în `VITE_GOOGLE_API_KEY`.
8. **Project number** (din Dashboard sau din setările proiectului, doar cifre) merge în `VITE_GOOGLE_APP_ID`.

Toate trei valorile ajung în browser și sunt publice prin natura lor. Protecția vine din originile autorizate și din restricțiile cheii.

## Deploy pe Vercel

Proiect Vercel separat, cu framework Vite. Adaugă cele trei variabile `VITE_GOOGLE_*` în *Settings → Environment Variables*, apoi fă deploy. Adaugă domeniul final la originile OAuth și la restricțiile cheii API (pașii 6 și 7 de mai sus).

## Limitări cunoscute

- **Mod Testing**: maximum 100 de utilizatori de test, adăugați manual. Ceilalți primesc „acces blocat”. Utilizatorii de test văd avertismentul „aplicație neverificată”.
- **Tokenul Google ține o oră.** După aceea apare bara „Reconectează”: un clic, fără pierderi.
- **Editări simultane**: rămâne ultima salvare pe același rând. Aplicația scrie doar rândul modificat și caută rândul după ID chiar înainte de scriere.
- Datele se reîncarcă la fiecare minut și la revenirea în tab.

## Cod

- `src/lib/schema.ts`: structura Sheet-ului, conversia rând ↔ obiect, formulele
- `src/lib/google/`: login (GIS), apeluri API, crearea Sheet-ului, partajare, Picker, `GoogleSheetStore`
- `src/lib/demoStore.ts`: aceeași interfață, pe localStorage
- `src/lib/calc.ts`: toate calculele afișate
- `src/screens/`: ecranele (Rezumat, Invitați, Costuri, Mese, De rezolvat, Setări)
