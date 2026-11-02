# BCF TaskFlow — Trimble Connect extension (v0.4.0)

## Oppsett
GitHub Pages: `main / root`. Manifest: https://trekasb.github.io/BCF-TaskFlow/manifest.json

## Funksjoner
- Leser prosjektets BCF Topics og viser saksinformasjon (opprettet av, opprettet dato, prioritet, status, fag/tags og ansvarlig når tilgjengelig fra API).
- Underoppgaver er **ikke egne BCF Topics**. De lagres som et JSON-datafelt i slutten av `description` på hovedsaken mellom `[BCFTaskFlow:v2]` og `[/BCFTaskFlow:v2]`.
- Hver underoppgave: ID, tittel, status (Ny/Pågår/Ferdig), relativ vekt.
- Vektet fremdrift: `sum(vekt for ferdige) / sum(alle vekter) * 100`. Ingen vekter => ingen fremdriftsdata.
- Opprette, endre status/vekt og slette underoppgaver. Endringer sendes som `PUT /projects/{id}/topics/{guid}` med oppdatert `description`.
- Demomodus uten lagring til Trimble.

## OBS — data, begrensninger og migrering
1. Metadata er **synlig i BCF-beskrivelsen** som JSON og følger eventuell eksport av denne. Dette er en midlertidig prototypeløsning, ikke et standard BCF-subtask-felt. Egnet til test, **ikke produksjon** uten vurdering av krav til informasjonsforvaltning og datalagring.
2. Andre redigerer hovedsaken samtidig: vi henter fersk topic før lagring, men API gir ikke garantert transaksjonell konfliktkontroll, og siste skribent kan overskrive samtidig redigering. Ikke bruk flerbruker parallell-redigering før robust backend/versjonssperre er implementert.
3. Oppgaver opprettet med v0.1.0 er fremdeles selvstendige BCF Topics. Disse slettes eller arkiveres **ikke automatisk**. Flytt dem manuelt ved behov og arkiver de gamle test-Topics i Trimble Connect.
4. Feltet for fag/tag leses fra `labels`, `tags` eller `topic_labels`, avhengig av Trimble-svar. Bruker-/dato- og prioritetsfelter vises hvis levert av BCF API.
5. Fremdrift påvirker **ikke** hovedsakens BCF-status.
6. Beskrivelsen kan bli lang. Det finnes en lokal størrelsesgrense på 55 000 tegn og 100 underoppgaver.
7. Autentisering gjennom Trimble Workspace API. Token lagres ikke i nettleserlagring.
8. API/CORS, metadatafelt og rettigheter må testes i faktisk Trimble Connect-prosjekt. En `PUT` kan feile dersom projektet ikke tillater endringer i beskrivelse.

## Test
1. Åpne extension i Trimble Connect, velg eksisterende BCF Topic.
2. Legg til «Modellering» (50), «Tegninger» (30), «Beskrivelse» (20).
3. Sett «Modellering» til Ferdig, forvent 50 %.
4. Oppdater siden, kontroller at deloppgaver/vekter består.
5. Kontroller at ingen nye BCF Topics ble opprettet.

Norconsult Norge · AI-assistert utvikling.

## Vekting 1–10 (v0.4.0)
Velges i nedtrekksmeny, ikke ved fritekst. 1–2: enkel/rask; 3–4: avgrenset; 5–6: moderat; 7–8: krevende; 9–10: omfattende, tverrfaglig og langvarig. Vekting er relative kompleksitetspoeng, ikke tidsbruk. Fremdrift er sum vekter på ferdige oppgaver delt på sum alle vekter. Nye underoppgaver får som standard vekt 3. Tidligere data med vekt over 10 må endres manuelt til ny skala; eksisterende verdier blir ikke automatisk omskrevet.

## Ferdigstillelsesgrad (v0.4.0)
Hver underoppgave har en nedtrekksmeny med 0 %, 25 %, 50 %, 75 % og 100 %. 0 % er ikke påbegynt, og 100 % er ferdigstilt. Samlet fremdrift beregnes som `sum(vekt * ferdigstillelsesgrad) / sum(vekter)`; resultatet vises som prosent. Status blir automatisk Ny ved 0 %, Pågår ved 25–75 % og Ferdig ved 100 %. Dersom en eksisterende oppgave mangler ferdigstillelsesgrad, tolkes status Ferdig som 100 % og øvrige statuser som 0 %.

## Dashboard for prosjektledelse
Egen **Dashboard**-fane viser prosjekttall uten å endre BCF-data: antall hovedsaker, åpne saker, underoppgaver, fullførte underoppgaver, samlet vektet fremdrift, saker som har 100 % deloppgaver men fortsatt er åpne, og forfalte hovedsaker dersom fristfelt er tilgjengelig. I tillegg vises statusfordeling, prioritetsfordeling, fag/tag og liste over saker som trenger oppfølging. Klikk på en sak i oppfølgingslisten for å åpne hovedsaken under «Oppgaver». «Skriv ut / PDF» bruker nettleserens utskriftsdialog.

**Datadefinisjoner:** Hovedsak = én BCF Topic; underoppgave = oppgave innebygd i BCFTaskFlow-JSON i beskrivelsen (ikke eget BCF Topic). Fremdrift beregnes ved vekt × ferdigstillelsesgrad, aggregert på alle registrerte underoppgaver. Status og prioritet kommer direkte fra BCF API. Forfalt krever gyldig `due_date` i API-responsen. Oversikten er et øyeblikksbilde, ikke en historisk tidsserie. Vi viser derfor ikke konstruerte «opprettet mot lukket»-trender eller frister som mangler. Dashboardet er lesbart, mens endringer skjer i Oppgaver-fanen.

## VDC-tilpasning fra ToDoPulse
Dashboardet følger samme begreper som ToDoPulse: WIP (pågående saker), backlog (åpne saker uten pågående status), åpne sakers alder, Created vs Closed per ISO-uke når datoer finnes, saker per ansvarlig, status/prioritet/fag og frist-/lukkingsoppfølging. Tall er basert på BCF-hovedsaker; underoppgavene bidrar separat til vektet fremdrift. Ingen dobbeltelling. For Created vs Closed kreves faktisk lukketdato: manglende dato rapporteres som datamangel, og historisk WIP eller cycle time vises ikke som om de var kjent. Dette er bevisst strengere enn estimering fra siste endringsdato. Test API-feltene i prosjektet.
