# Shopify Cleaner — Inventory Survey App

A multi-store inventory verification web app. Admins import a product catalogue from Excel; clerks use their smartphones to survey products one by one. The system tracks verification status per store and generates a comprehensive Excel report.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Styling | Tailwind CSS |
| Auth | next-auth (Credentials) |
| Excel | xlsx |
| Passwords | bcryptjs |

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a remote DB)
- npm or yarn

---

## Setup

### 1. Clone & install

```bash
cd /Users/flaviosimmi/Shopify_Cleaner
npm install
```

### 2. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/shopify_cleaner"
NEXTAUTH_SECRET="your-secret-here"   # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Database setup

Create the database (if it doesn't exist), then run Prisma migrations and seed:

```bash
# Push the schema to the database
npm run db:push

# (Or run migrations in dev)
npm run db:migrate

# Seed with stores + demo users
npm run db:seed
```

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Default credentials (after seed)

| Role | Email | Password | Store |
|------|-------|----------|-------|
| Admin | admin@shopifycleaner.com | admin123 | — |
| Clerk | clerk1@shopifycleaner.com | clerk123 | Store 1 |
| Clerk | clerk2@shopifycleaner.com | clerk123 | Store 2 |
| Clerk | clerk3@shopifycleaner.com | clerk123 | Store 3 |

> Change passwords after first login in production.

---

## Usage

### Admin workflow

1. Log in as admin at `/login`
2. Go to **Import Products** (`/admin/import`) and upload your Excel file
3. Hand out clerk credentials to store staff
4. Monitor progress from the **Dashboard** (`/`)
5. When done, go to **Download Report** (`/admin/report`) and export the Excel

### Clerk workflow

1. Log in at `/login` from a smartphone
2. You're automatically taken to the survey (`/survey`)
3. For each product: tap your status (Present / Not Found / Not Sure / Skip)
4. If Present, optionally enter the detected quantity and a note
5. Tap **Confirm & Next** to proceed

### Excel import format

The import file must have a header row with these columns (order doesn't matter, case-insensitive):

| Column | Required | Notes |
|--------|----------|-------|
| SKU | Yes | Unique identifier; used for upsert |
| Product Name | Yes | — |
| Brand | No | — |
| Category | No | — |
| Image URL | No | Full URL to product image |
| Theoretical Qty | No | Expected stock count (default 0) |

### Excel report columns

`SKU | Product Name | Brand | Category | Theoretical Qty | Global Presence | Store1 Status | Store1 Qty | Store2 Status | Store2 Qty | Store3 Status | Store3 Qty | Total Detected Qty | Final Status | Verification Count | Last Verification Date | Notes`

### Final status logic

| Status | Condition |
|--------|-----------|
| **DISPONIBILE** | All stores found it AND detected qty matches theoretical |
| **NON TROVATO** | No store found it |
| **DISCREPANZA** | Found in at least one store but qty differs from theoretical |
| **DA RICONTROLLARE** | Any "not sure" result OR mixed present/not_present across stores |
| **NON VERIFICATO** | No verifications yet |

---

## Project structure

```
shopify-cleaner/
├── prisma/
│   ├── schema.prisma       # DB schema
│   └── seed.ts             # Seed script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── import/route.ts
│   │   │   ├── products/route.ts
│   │   │   ├── report/route.ts
│   │   │   ├── stats/route.ts
│   │   │   └── verifications/route.ts
│   │   ├── admin/
│   │   │   ├── import/page.tsx
│   │   │   └── report/page.tsx
│   │   ├── login/page.tsx
│   │   ├── survey/page.tsx
│   │   ├── page.tsx            # Dashboard
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── SessionProvider.tsx
│   ├── lib/
│   │   ├── auth.ts             # NextAuth config
│   │   ├── db.ts               # Prisma singleton
│   │   └── excel.ts            # Import parser + report generator
│   └── types/
│       └── index.ts
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Avviare i server di rete (produzione)

Il sito `https://inventory.genioengineering.com` richiede due processi attivi:
1. **Next.js** — il server dell'app
2. **Cloudflare Tunnel** — espone il server su internet tramite HTTPS

### Setup una-tantum del tunnel (solo la prima volta)

Il tunnel usa un `config.yml` locale con le ingress rules. Se non esiste ancora:

```bash
# Crea il file di configurazione
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: shopify-cleaner
ingress:
  - hostname: inventory.genioengineering.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

Questo file è già presente sulla macchina WSL di sviluppo.

---

### Mac

#### Avvio

```bash
# 1. Build (solo se hai modificato il codice)
npm run build

# 2. Avvia Next.js (caffeinate impedisce lo standby)
nohup caffeinate -i npm start > /tmp/nextjs.log 2>&1 &

# 3. Avvia il tunnel Cloudflare
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run --token $(cloudflared tunnel token shopify-cleaner) > /tmp/cloudflared.log 2>&1 &
```

Oppure tutto in una riga:

```bash
npm run build && nohup caffeinate -i npm start > /tmp/nextjs.log 2>&1 & sleep 5 && nohup cloudflared tunnel --config ~/.cloudflared/config.yml run --token $(cloudflared tunnel token shopify-cleaner) > /tmp/cloudflared.log 2>&1 &
```

#### Stop

```bash
kill $(lsof -ti :3000)
pkill -f "cloudflared tunnel"
```

#### Verifica stato

```bash
lsof -i :3000
cloudflared tunnel info shopify-cleaner
tail -f /tmp/nextjs.log
tail -f /tmp/cloudflared.log
```

#### Standby

Con `caffeinate -i` il Mac **non va in standby** finché Next.js è attivo. Se va comunque in standby (es. coperchio chiuso), al risveglio Cloudflare Tunnel si riconnette automaticamente e Next.js riprende senza intervento.

> Per un'installazione permanente che sopravvive al riavvio, configura i servizi con `launchd`.

---

### WSL (Windows Subsystem for Linux)

`caffeinate` non è disponibile su WSL. Lo standby è controllato da Windows: WSL si sospende e riprende insieme all'host.

#### Avvio

```bash
# 1. Build (solo se hai modificato il codice)
npm run build

# 2. Avvia Next.js in background
nohup npm start > /tmp/nextjs.log 2>&1 &

# 3. Avvia il tunnel Cloudflare
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run --token $(cloudflared tunnel token shopify-cleaner) > /tmp/cloudflared.log 2>&1 &
```

#### Stop

```bash
kill $(lsof -ti :3000)
pkill -f "cloudflared tunnel"
```

#### Verifica stato

```bash
lsof -i :3000
cloudflared tunnel info shopify-cleaner
tail -f /tmp/nextjs.log
tail -f /tmp/cloudflared.log
```

#### Standby

Quando Windows va in standby WSL viene sospeso. Al risveglio:
- **Cloudflare Tunnel** si riconnette automaticamente in pochi secondi
- **Next.js** riprende senza intervento manuale

Per evitare che Windows vada in standby mentre i server sono attivi, imposta il piano di alimentazione su **Alte prestazioni** oppure esegui da PowerShell (come amministratore):

```powershell
# Disabilita standby finché la sessione è aperta
powercfg /change standby-timeout-ac 0
```

---

### Windows (nativo — PowerShell)

Usa PowerShell. Non sono disponibili `nohup`, `caffeinate`, `lsof` o `pkill`.

#### Avvio

```powershell
# 1. Build (solo se hai modificato il codice)
npm run build

# 2. Avvia Next.js in background
Start-Process -NoNewWindow npm -ArgumentList "start" `
  -RedirectStandardOutput "$env:TEMP\nextjs.log" `
  -RedirectStandardError  "$env:TEMP\nextjs-err.log"

# 3. Avvia il tunnel Cloudflare
$TOKEN = cloudflared tunnel token shopify-cleaner
Start-Process -NoNewWindow cloudflared `
  -ArgumentList "tunnel --config `"$env:USERPROFILE\.cloudflared\config.yml`" run --token $TOKEN" `
  -RedirectStandardOutput "$env:TEMP\cloudflared.log"
```

#### Stop

```powershell
# Ferma Next.js (processo sulla porta 3000)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force

# Ferma il tunnel Cloudflare
Stop-Process -Name cloudflared -Force
```

#### Verifica stato

```powershell
# Next.js attivo?
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# Tunnel attivo?
cloudflared tunnel info shopify-cleaner

# Log in tempo reale
Get-Content "$env:TEMP\nextjs.log" -Wait
Get-Content "$env:TEMP\cloudflared.log" -Wait
```

#### Standby

Per impedire lo standby di Windows finché i server sono attivi, esegui da PowerShell (come amministratore) prima di avviare:

```powershell
# Disabilita standby su corrente di rete
powercfg /change standby-timeout-ac 0

# Ripristina dopo aver fermato i server (es. 30 minuti)
powercfg /change standby-timeout-ac 30
```

---

## Production deployment

1. Set `NODE_ENV=production` and a strong `NEXTAUTH_SECRET`
2. Run `npm run build` then `npm start`
3. Use a managed PostgreSQL service (e.g. Supabase, Railway, Neon)
4. Optionally add a reverse proxy (nginx) and SSL

---

## Development commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:studio    # Open Prisma Studio (DB GUI)
npm run db:push      # Push schema changes to DB
npm run db:migrate   # Run DB migrations
npm run db:seed      # Seed stores & demo users
```
