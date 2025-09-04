// Einstiegspunkt für die Getränkekasse
const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const db = require('./database');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL Verbindung initialisieren
async function initializeDatabase() {
  try {
    await db.connect();
    console.log('✅ Datenbank erfolgreich verbunden');
  } catch (error) {
    console.error('❌ Datenbankverbindung fehlgeschlagen:', error);
    console.log('Verwende für den Start: sudo systemctl start postgresql');
    process.exit(1);
  }
}

// Routen einbinden - Verwende PostgreSQL API
const apiRoutes = require('./routes/api-postgres');
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;

// Starte Server mit Datenbankverbindung
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Getränkekasse läuft auf Port ${PORT} mit PostgreSQL`);
  });
}).catch(error => {
  console.error('❌ Fehler beim Starten der App:', error);
  process.exit(1);
});
