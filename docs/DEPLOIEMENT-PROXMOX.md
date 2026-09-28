# Déploiement sur Proxmox VE (conteneur LXC + Docker)

Ce guide installe Calendrier Sport dans un conteneur LXC Debian sur Proxmox VE, avec
Docker Compose, puis le rend accessible à tes amis **uniquement via le VPN**
(Tailscale ou WireGuard).

```
 Téléphones / PC des amis
          │  VPN (Tailscale ou WireGuard)
          ▼
┌──────────────────────── Hôte Proxmox VE ─────────────────────────┐
│  LXC « calendrier-sport » (Debian 12, non privilégié, nesting=1)  │
│  ┌──────────────┐  /api  ┌──────────────┐  SQL  ┌──────────────┐ │
│  │ web (nginx)  │ ─────► │ api (Node.js │ ────► │ db           │ │
│  │ SPA React    │        │  Express 5)  │       │ PostgreSQL 16│ │
│  └──────┬───────┘        └──────────────┘       └──────┬───────┘ │
│    :8080 (seul port publié)                   volume pgdata      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Créer le conteneur LXC

Ressources conseillées pour un groupe d'amis : **2 vCPU, 2 Go de RAM, 16 Go de disque**
(l'application elle-même ne consomme que quelques centaines de Mo ; la marge sert aux builds Docker).

### Via l'interface web

1. *Datacenter → local → CT Templates → Templates* : télécharger **debian-12-standard**
   (ou `debian-13-standard` sur Proxmox VE 9).
2. *Create CT* :
   - **Unprivileged container** : coché (plus sûr) ;
   - Disque : 16 Go ; CPU : 2 ; Mémoire : 2048 Mo ; réseau en DHCP ou IP fixe ;
3. Avant de démarrer : *Options → Features* → cocher **nesting** et **keyctl**
   (indispensables pour faire tourner Docker dans un LXC non privilégié).

### Ou en ligne de commande (sur l'hôte Proxmox)

```bash
pveam update
pveam available --section system | grep debian-12      # repérer le nom exact du template
pveam download local debian-12-standard_12.7-1_amd64.tar.zst   # adapter au nom affiché

pct create 120 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname calendrier-sport \
  --cores 2 --memory 2048 --swap 512 \
  --rootfs local-lvm:16 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --onboot 1
```

> **Stockage ZFS ?** Docker (pilote `overlay2`) fonctionne sur ZFS à partir d'OpenZFS 2.2
> (Proxmox VE ≥ 8.1). Sur une version plus ancienne, place le rootfs du LXC sur un stockage
> LVM-thin/ext4.

## 2. (Tailscale uniquement) Donner accès à `/dev/net/tun`

Tailscale a besoin du périphérique TUN dans le conteneur. Sur **l'hôte Proxmox**, ajoute à
`/etc/pve/lxc/120.conf` (remplace 120 par l'ID de ton CT) :

```
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```

Puis démarre le conteneur : `pct start 120` et entre dedans : `pct enter 120`.

## 3. Installer Docker dans le LXC

```bash
apt update && apt full-upgrade -y
apt install -y ca-certificates curl git openssl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker run --rm hello-world
```

> Si `hello-world` échoue avec une erreur *permission denied* liée à AppArmor ou à un
> `sysctl` (`net.ipv4.ip_unprivileged_port_start`…), vérifie que **nesting** et **keyctl**
> sont activés et que l'hôte Proxmox est à jour (`apt full-upgrade` sur l'hôte) : des
> incompatibilités runc ↔ LXC ont été corrigées par les mises à jour de Proxmox.

## 4. Déployer l'application

```bash
git clone https://github.com/ravenbaudry/calendrier-sport.git /opt/calendrier-sport
cd /opt/calendrier-sport

cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
nano .env        # BIND_ADDRESS, APP_PORT, INVITE_CODE (optionnel)…

docker compose up -d --build
docker compose ps          # les 3 services doivent être « healthy »
docker compose logs -f api
```

Au premier démarrage, PostgreSQL exécute `database/init/*.sql` (tables + catalogue de
80 exercices). L'application répond sur `http://<IP-du-LXC>:8080`.

> 💡 Définis `INVITE_CODE` dans `.env` pour que seuls ceux qui connaissent le code puissent
> créer un compte, même s'ils ont accès au VPN.

## 5. Rendre l'application accessible via le VPN

### Option A — Tailscale dans le LXC (recommandé, HTTPS inclus)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up                           # ouvrir le lien affiché pour autoriser la machine
```

Pour n'exposer l'application **que** sur le tailnet, avec un certificat HTTPS valide :

1. Dans `.env` : `BIND_ADDRESS=127.0.0.1`, puis `docker compose up -d`.
2. Dans la console d'admin Tailscale : *DNS* → activer **MagicDNS** et **HTTPS Certificates**.
3. Dans le LXC :
   ```bash
   tailscale serve --bg 8080
   tailscale serve status
   ```
4. L'application est disponible sur `https://calendrier-sport.<ton-tailnet>.ts.net`.

Pour tes amis : invite-les dans ton tailnet, ou utilise le **partage de machine**
(*Machines → … → Share*) : ils gardent leur propre compte Tailscale et ne voient que ce
serveur. Les ACL Tailscale permettent de restreindre l'accès au seul port 443 de ce nœud.

### Option B — WireGuard

Si WireGuard tourne déjà (sur l'hôte, un routeur, OPNsense…), le LXC doit simplement être
joignable depuis le sous-réseau VPN (ex. `10.8.0.0/24`). Deux façons de filtrer :

- **WireGuard dans le LXC** : mets `BIND_ADDRESS` sur l'IP WireGuard du LXC (ex. `10.8.0.1`) ;
  le port n'écoute alors que sur l'interface VPN.
- **WireGuard ailleurs** : garde `BIND_ADDRESS=0.0.0.0` et active le **pare-feu Proxmox** sur
  le CT (*CT → Firewall*) : autoriser `TCP 8080` depuis `10.8.0.0/24` uniquement, politique
  d'entrée `DROP`.

> ⚠️ Docker insère ses propres règles iptables : un `ufw` configuré *dans* le LXC ne bloque
> pas les ports publiés par Docker. Filtre avec `BIND_ADDRESS` ou avec le pare-feu Proxmox
> (appliqué côté hôte, hors de portée de Docker).

### Installer l'app sur le téléphone

Ouvre l'URL dans Safari/Chrome → *Partager → Sur l'écran d'accueil* : l'app s'ouvre alors en
plein écran comme une application native (manifest PWA inclus).

## 6. Sauvegardes

- **Logique (recommandé)** : `scripts/backup.sh` produit un `pg_dump` compressé dans
  `./backups/` et supprime ceux de plus de 14 jours.
  ```bash
  crontab -e
  0 3 * * * /opt/calendrier-sport/scripts/backup.sh >> /var/log/calendrier-backup.log 2>&1
  ```
  Restauration : `./scripts/restore.sh backups/calendrier-AAAAMMJJ-HHMMSS.sql.gz`
- **Proxmox** : planifie aussi une sauvegarde `vzdump` du CT (*Datacenter → Backup*), idéalement
  vers un Proxmox Backup Server. Le dossier `backups/` étant dans le CT, les dumps y sont inclus.

## 7. Mises à jour

```bash
cd /opt/calendrier-sport
./scripts/backup.sh
git pull
docker compose up -d --build
docker image prune -f
```

> Les scripts de `database/init/` ne sont exécutés **qu'à la création du volume**. Une
> évolution future du schéma devra être appliquée à la main :
> `docker compose exec -T db psql -U calendrier -d calendrier < migration.sql`.

## 8. Dépannage

| Symptôme | Piste |
| --- | --- |
| `api` reste *unhealthy* | `docker compose logs api` : secret manquant, `JWT_SECRET` < 32 caractères, base injoignable |
| Page blanche / 502 | `docker compose ps` : l'API a-t-elle démarré ? `docker compose logs web` |
| « Serveur injoignable. Vérifie ta connexion au VPN. » | le téléphone n'est pas connecté au VPN, ou mauvais `BIND_ADDRESS` |
| Classements décalés d'un jour | vérifier `TZ` dans `.env` |
| Réinitialiser complètement | `docker compose down -v` (⚠ supprime toutes les données) |
