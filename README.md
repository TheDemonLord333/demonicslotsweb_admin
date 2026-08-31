# Demonic Slots Admin

Eigenständige, leichtgewichtige Single-Page-Web-App (Vanilla HTML/CSS/JS, kein
Build-Step nötig) zur Verwaltung der Coin-Guthaben von Spielern des Spiels
**Demonic Slots**. Reines internes Admin-Tool für den Betreiber – kein
Multi-User-Anspruch, keine Registrierung.

## Funktionen

- **Login** mit Backend-URL (vorausgefüllt) und Admin-Token. Der Token wird
  ausschließlich im `sessionStorage` des Browser-Tabs gehalten (nicht in
  `localStorage`, nirgends im Code hinterlegt) und verschwindet beim Schließen
  des Tabs oder per „Abmelden“.
- **Spielerübersicht**: Tabelle aller Spieler mit Username, Guthaben und
  letztem Aktualisierungszeitpunkt, inkl. Such-/Filterfeld und
  Aktualisieren-Button.
- **Guthaben & Username bearbeiten**: Jeder Spieler wird intern über eine
  stabile, unveränderliche `id` angesprochen (nicht mehr über den
  Username) – ein Rename ändert also nur das Label, nicht die Identität
  des Spielers, und Rename/Guthaben-Änderung können unabhängig
  voneinander erfolgen. Klick auf einen Spieler öffnet ein Modal mit
  Erstellungs-/Aktualisierungsdatum und der Admin-Revision. Username
  (3–20 Zeichen: Buchstaben, Zahlen, `_`) und Guthaben (nicht-negative
  Ganzzahl) werden vor dem Speichern clientseitig validiert; ein Klick auf
  „Speichern“ ruft nur die Endpunkte auf, deren Wert sich tatsächlich
  geändert hat. Ein bereits vergebener Username liefert eine klare
  Fehlermeldung, das Modal bleibt dabei offen.
- **Fehlerbehandlung**: ungültiger/abgelaufener Token führt zurück zum Login
  mit Hinweistext, Netzwerk-/Serverfehler zeigen eine Fehlermeldung mit
  „Erneut versuchen“-Button.
- **Responsive**: Tabelle wird auf schmalen Viewports (Tablet/Handy) zu einer
  gestapelten Karten-Ansicht.
- **Theme**: dunkles, gotisches „Demonic“-Design, abgestimmt auf die Farben
  aus `DemonicPalette.swift` (siehe unten), als CSS Custom Properties in
  `css/styles.css` definiert.

## Projektstruktur

```
.
├── index.html          # Markup für Login-, Dashboard-View und Edit-Modal
├── css/
│   └── styles.css       # Demonic-Theme (CSS Custom Properties, Layout, Responsive)
├── js/
│   ├── api.js            # Schlanker Fetch-Client für /api/admin/*
│   └── app.js             # UI-Logik, State, Rendering, Event-Handling
├── package.json
└── README.md
```

Kein Framework, kein Bundler, keine Abhängigkeiten zur Laufzeit – die App
besteht aus statischen Dateien, die von jedem Webserver ausgeliefert werden
können.

## Lokal starten

Da die App aus reinem Static HTML/CSS/JS (ES-Modulen) besteht, reicht ein
beliebiger statischer Webserver – ein direktes Öffnen der `index.html` per
`file://` funktioniert wegen `type="module"` in den meisten Browsern nicht
zuverlässig.

**Variante 1 – npm-Script:**

```bash
npm start
```

Startet `serve` per `npx` auf `http://localhost:5173`.

**Variante 2 – Python (falls vorhanden, keine Node-Installation nötig):**

```bash
python3 -m http.server 5173
```

Anschließend im Browser `http://localhost:5173` öffnen, Backend-URL
(vorausgefüllt mit `https://demonicslots.thedemonlord333.me`) und
`ADMIN_TOKEN` eingeben.

## Deployment

Da es sich um rein statische Dateien handelt, eignet sich jedes
Static-Hosting, z. B.:

- **GitHub Pages**: Repository-Inhalt (oder einen `dist`-artigen Ordner mit
  diesen Dateien) als Pages-Quelle einrichten.
- **Netlify / Vercel (Static Site)**: Repo verbinden, Build-Command leer
  lassen, Publish-Directory auf das Repo-Root setzen.
- **Beliebiger Webserver / Reverse Proxy (Nginx, Caddy, S3 + CDN, …)**: Die
  drei Dateien/Ordner (`index.html`, `css/`, `js/`) einfach als statische
  Assets ausliefern.

Wichtig für den Betrieb hinter einer eigenen Domain: Das Backend
(`https://demonicslots.thedemonlord333.me`) muss CORS-Requests von der
Origin akzeptieren, unter der diese Admin-App gehostet wird, damit die
Browser-Requests nicht blockiert werden. Das Backend selbst wird von diesem
Projekt nicht verändert.

## Sicherheitshinweis

- Der `ADMIN_TOKEN` wird **nie** im Quellcode hinterlegt, sondern bei jedem
  Login manuell eingegeben und nur für die Dauer der Browser-Session im
  `sessionStorage` gehalten.
- Da es sich um ein reines Admin-Tool handelt, sollte die gehostete Instanz
  nicht öffentlich verlinkt und idealerweise zusätzlich (z. B. per
  Basic-Auth am Webserver oder IP-Beschränkung) abgesichert werden – die App
  selbst bringt keinen eigenen Zugriffsschutz jenseits des Admin-Tokens mit.

## Backend-API (Referenz, nicht Teil dieses Projekts)

Basis-URL: `https://demonicslots.thedemonlord333.me`

Jeder Request an `/api/admin/*` benötigt den Header
`Authorization: Bearer <ADMIN_TOKEN>`.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/admin/players` | Liste aller Spieler. Jeder Eintrag enthält ein stabiles `id`-Feld – **das** ist der eigentliche Identifier, `username` ist nur ein änderbares Label darauf |
| `GET` | `/api/admin/players/:id` | Einzelner Spieler, adressiert über seine stabile `id` (`404` bei unbekannter ID) |
| `PATCH` | `/api/admin/players/:id/balance` | Body `{ "balance": Int }` (nicht-negativ); Server erhöht `adminRevision` automatisch |
| `PATCH` | `/api/admin/players/:id/username` | Body `{ "username": String }` (3–20 Zeichen, Buchstaben/Zahlen/`_`); `404` falls `:id` nicht existiert, `409` bei bereits vergebenem Namen (durch einen *anderen* Spieler), `400` bei ungültigem Format. Ändert nicht `coinBalance`/`adminRevision` |

`401` bei fehlendem/falschem Token, `500` wenn `ADMIN_TOKEN` serverseitig
nicht gesetzt ist.

> Hinweis: `id` sowie die beiden `:id`-basierten Endpunkte oben sind nicht
> Teil der ursprünglichen Backend-Spezifikation und wurden für dieses
> Feature ergänzt (siehe `demonicslotsios`-Repo, Branch
> `feature/admin-rename-player`). Das Backend migriert seine bestehende
> Datenbank beim ersten Start mit diesem Code automatisch (alte Tabelle
> bleibt als Backup erhalten) – muss aber deployt sein, bevor diese App
> funktioniert: mit dem alten Backend-Stand laufen `GET`/`PATCH
> .../players/:id` ins Leere (404), weil die Routen dort noch über
> `:username` adressiert werden.
