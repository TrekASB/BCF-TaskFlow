# BCF TaskFlow – Trimble Connect extension

Versjon 0.1.0 (prototype). Hovedoppgaver og underoppgaver er **selvstendige BCF Topics**.

## Kjøring
- Aktiver GitHub Pages fra `main` / root under Settings → Pages.
- Registrer manifest URL: `https://trekasb.github.io/BCF-TaskFlow/manifest.json` i Trimble Connect.
- Åpne fra Trimble Connect 3D Viewer og godkjenn tilgang til token.
- Bruk **Demo** for UI uten tilgang til et Trimble-prosjekt.

## Datamodell
- Hvert barn er en vanlig BCF Topic, opprettet med en markør i beskrivelsen: `[BCFTaskFlow parent:<GUID>]`.
- Hovedoppgaven får en `related_topics`-referanse til barnet dersom API-et tillater oppdatering.
- Markøren er vår egen metadata-konvensjon, ikke en del av buildingSMART BCF-standarden.
- Kun oppgaver med markøren inngår i TaskFlow-hierarkiet. Eksisterende relasjoner endres ikke utilsiktet.
- Fremdrift = antall ferdige underoppgaver / antall underoppgaver.
- BCF-status på hovedoppgaven oppdateres ikke automatisk.

## Begrensninger
Dette er første integrasjonsprototype. API-tilganger, Trimble-prosjektets statuser, CORS, resultatpaginering og `related_topics` må valideres mot et faktisk prosjekt. Opprettelse av en ny underoppgave kan lykkes selv om koblingsoperasjonen feiler; da beholdes barnet med forelder-markør og vises etter oppfriskning. Ingen token lagres permanent. Data i demomodus er kun i minnet.

Utviklet med AI-assistanse. Norconsult Norge.
