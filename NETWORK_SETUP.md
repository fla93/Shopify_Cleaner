# Connessione da Rete Locale (Smartphone/Tabella)

## Come funziona

Il programma è ora configurato per funzionare su **rete locale**, permettendo ai dispositivi (smartphone, tablet, portatili) di accedere dall'indirizzo IP del tuo Mac.

## Step-by-step

### 1️⃣ Avvia il server su rete locale

```bash
npm run dev
```

Vedrai un output simile a:

```
📱 ACCESSO DA RETE LOCALE:

  🖥️  Computer locale:  http://localhost:3000
  📱 Smartphone/Tablet: http://192.168.1.100:3000

✓ NextAuth configurato per accettare connessioni da rete locale
```

### 2️⃣ Sul tuo smartphone/tablet

Apri il **browser**  (Safari, Chrome, etc) e vai a:

```
http://192.168.1.100:3000
```

(Sostituisci `192.168.1.100` con l'IP mostrato nel output)

### 3️⃣ Accedi con le credenziali

**Admin:**
- Email: `admin@shopifycleaner.com`
- Password: `admin123`

**Commesso:**
- Email: `clerk1@shopifycleaner.com`
- Password: `clerk123`

---

## Troubleshooting

### ❌ "Non riesco a connettermi dall'IP"

1. **Verifica che il Mac e lo smartphone siano sulla stessa WiFi**
2. **Verifica l'IP mostrato nel output di npm run dev**
3. **Prova con http:// non https://**
4. **Disabilita il VPN se attivo**

### ❌ "L'IP cambia ogni volta"

L'indirizzo IP locale può cambiare. Esegui sempre `npm run dev` per vedere l'IP corrente.

---

## Comandi

| Comando | Cosa fa |
|---------|---------|
| `npm run dev` | Avvia su rete locale (0.0.0.0) |
| `npm run dev:local` | Avvia solo su localhost (computer locale) |

---

## Note di sicurezza

⚠️ In **development**, le connessioni da rete locale sono permesse.  
In **production**, configura `.env` con un NEXTAUTH_URL specifico e firewall appropriati.
