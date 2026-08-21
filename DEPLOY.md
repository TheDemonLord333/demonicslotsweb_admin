# Deployment: nginx + certbot + pm2

Runbook für das Hosting von **Demonic Slots Admin** unter
`https://dsa.thedemonlord333.me` auf einem eigenen Linux-Server (Ubuntu/Debian
angenommen). Die App ist rein statisch (HTML/CSS/JS) – `pm2` wird hier nur
genutzt, um einen kleinen statischen Fileserver-Prozess dauerhaft am Laufen
zu halten (passend zu einem Server, auf dem ohnehin andere Node-Prozesse per
pm2 verwaltet werden). `nginx` terminiert TLS und reicht Requests an diesen
Prozess durch.

## 0. Voraussetzungen

- DNS: `A`-Record (und ggf. `AAAA`) für `dsa.thedemonlord333.me` zeigt auf
  die Server-IP.
- Server mit sudo-Zugriff, Node.js (LTS) installiert.
- Port 80/443 sind für den Server offen (Firewall/Security Group).
- Das Backend unter `https://demonicslots.thedemonlord333.me` muss
  CORS-Requests von `https://dsa.thedemonlord333.me` akzeptieren (Backend
  wird von diesem Projekt nicht verändert – ggf. dort separat prüfen/anpassen).

## 1. Code auf den Server holen

```bash
sudo mkdir -p /var/www/dsa-admin
sudo chown $USER:$USER /var/www/dsa-admin
git clone https://github.com/TheDemonLord333/demonicslotsweb_admin.git /var/www/dsa-admin
cd /var/www/dsa-admin
git checkout main   # bzw. den gewünschten Branch/Tag
```

Für spätere Updates reicht:

```bash
cd /var/www/dsa-admin
git pull
pm2 restart dsa-admin
```

(kein Build-Schritt nötig, da reines Static-Setup.)

## 2. pm2 installieren und statischen Server einrichten

```bash
sudo npm install -g pm2 serve
```

App über pm2 starten (liefert die statischen Dateien lokal auf Port 5173):

```bash
cd /var/www/dsa-admin
pm2 start serve --name dsa-admin -- -s . -l 5173
```

- `-s .` liefert `index.html` als Fallback (SPA-Verhalten), `.` = Repo-Root.
- `-l 5173` = lokaler Port, den nginx gleich per Reverse-Proxy anspricht.

pm2-Prozess dauerhaft machen (übersteht Reboots):

```bash
pm2 save
pm2 startup    # gibt einen Befehl aus, den du 1x mit sudo ausführen musst
```

Status prüfen:

```bash
pm2 status
pm2 logs dsa-admin
```

## 3. nginx-Serverblock anlegen

```bash
sudo apt update
sudo apt install -y nginx
```

Datei `/etc/nginx/sites-available/dsa.thedemonlord333.me`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dsa.thedemonlord333.me;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktivieren und testen:

```bash
sudo ln -s /etc/nginx/sites-available/dsa.thedemonlord333.me /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Firewall (falls `ufw` genutzt wird):

```bash
sudo ufw allow 'Nginx Full'
```

An diesem Punkt sollte `http://dsa.thedemonlord333.me` bereits die App
ausliefern (noch ohne HTTPS).

## 4. HTTPS mit certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dsa.thedemonlord333.me
```

- Certbot fragt nach einer E-Mail-Adresse (für Ablauf-Benachrichtigungen)
  und passt den nginx-Serverblock automatisch an (fügt `listen 443 ssl`,
  Zertifikatspfade sowie einen HTTP→HTTPS-Redirect ein).
- Am Ende bestätigen, dass HTTP-Requests auf HTTPS umgeleitet werden sollen
  (Option „redirect“).

Danach ist `https://dsa.thedemonlord333.me` erreichbar.

Auto-Renewal prüfen (certbot richtet i. d. R. automatisch einen Timer ein):

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## 5. Optional: Basic-Auth als zusätzliche Zugriffsschutz-Schicht

Da es sich um ein rein internes Admin-Tool handelt, ist ein zusätzlicher
Schutz vor dem eigentlichen Login sinnvoll:

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/dsa-admin.htpasswd deinusername
```

Im Serverblock (im `location / {}`-Block, **nach** dem certbot-Lauf ergänzen):

```nginx
auth_basic "Demonic Slots Admin";
auth_basic_user_file /etc/nginx/dsa-admin.htpasswd;
```

Danach `sudo nginx -t && sudo systemctl reload nginx`.

## 6. Kurz-Checkliste für Updates

```bash
cd /var/www/dsa-admin
git pull
pm2 restart dsa-admin
```

nginx/certbot müssen dabei normalerweise nicht angefasst werden, da sich nur
statische Dateien ändern.
