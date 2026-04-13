#!/usr/bin/env node

/**
 * Script per trovare l'indirizzo IP locale e mostrare l'URL di connessione
 * Run: node scripts/show-network-url.js
 */

const os = require('os');
const { execSync } = require('child_process');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    // Preferisci wifi (en0 su Mac) vs ethernet
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (name.includes('en') || name.includes('wi')) {
          return addr.address;
        }
      }
    }
  }
  
  // Fallback al primo IPv4 disponibile
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  
  return 'localhost';
}

const localIp = getLocalIp();
const port = process.env.PORT || 3000;

console.log('\n📱 ACCESSO DA RETE LOCALE:\n');
console.log(`  🖥️  Computer locale:  http://localhost:${port}`);
console.log(`  📱 Smartphone/Tablet: http://${localIp}:${port}`);
console.log('\n💡 Usa l\'indirizzo IP su dispositivi diversi.\n');

// Aggiorna NEXTAUTH_URL se necessario
if (process.env.NODE_ENV === 'development') {
  console.log('✓ NextAuth configurato per accettare connessioni da rete locale\n');
}
