
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Limit für User-Kontostände
const MAX_USER_BALANCE = 150.00;

// Hilfsfunktion für feste Dezimalstellen (verhindert JavaScript-Rundungsfehler)
function roundToTwoDecimals(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Hilfsfunktionen zum Lesen und Schreiben der Daten
function readData() {
  try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    // Alle Beträge beim Laden korrigieren
    if (data.users) {
      data.users.forEach(user => {
        if (typeof user.balance === 'number') {
          user.balance = roundToTwoDecimals(user.balance);
        }
      });
    }
    return data;
  } catch (err) {
    return { drinks: [], users: [], admin: { password: "9999" } };
  }
}

function writeData(data) {
  // Alle Beträge vor dem Speichern korrigieren
  if (data.users) {
    data.users.forEach(user => {
      if (typeof user.balance === 'number') {
        user.balance = roundToTwoDecimals(user.balance);
      }
    });
  }
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// PIN ändern
router.post('/change-pin', (req, res) => {
  const { username, oldPin, newPin } = req.body;
  if (!username || !oldPin || !newPin || newPin.length !== 4 || oldPin.length !== 4) {
    return res.status(400).json({ error: 'Ungültige Eingabe' });
  }
  const data = readData();
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  if (user.pin !== oldPin) {
    return res.status(403).json({ error: 'Alter PIN ist falsch.' });
  }
  user.pin = newPin;
  writeData(data);
  res.json({ success: true });
});

// Account löschen
router.post('/deleteuser', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Kein Nutzer angegeben' });
  const data = readData();
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  if ((user.balance || 0) < 0) return res.status(400).json({ error: 'Account kann nicht gelöscht werden, wenn Guthaben im Minus ist.' });
  data.users = data.users.filter(u => u.username !== username);
  writeData(data);
  res.json({ success: true });
});

// Alle User für das Login-Grid
router.get('/allusers', (req, res) => {
  const data = readData();
  res.json(data.users);
});

// Geld auszahlen
router.post('/withdraw', (req, res) => {
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Ungültige Eingabe' });
  }
  const data = readData();
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  const newBalance = (user.balance || 0) - amount;
  if (newBalance < -10) {
    return res.status(400).json({ error: 'Kohle her' });
  }
  user.balance = newBalance;
  // push transaction (negative amount for withdrawal)
  if (!Array.isArray(user.consumption)) user.consumption = [];
  user.consumption.push({ date: new Date().toISOString(), amount: -amount, type: 'withdraw', description: 'Auszahlung' });
  writeData(data);
  res.json({ success: true, balance: user.balance });
});

const DATA_PATH = path.join(__dirname, '../data.json');

// --- Getränke ---
router.get('/drinks', (req, res) => {
  const data = readData();
  res.json(data.drinks);
});

// --- Nutzer ---
router.post('/register', (req, res) => {
  const { username, pin, balance } = req.body;
  if (!username || !pin || pin.length !== 4) {
    return res.status(400).json({ error: 'Ungültige Eingabe' });
  }
  const data = readData();
  if (data.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Nutzer existiert bereits' });
  }
  let startBalance = 0;
  if (typeof balance === 'number' && balance >= 0) {
    startBalance = Math.min(balance, MAX_USER_BALANCE); // Begrenze auf Maximum
  }
  data.users.push({ username, pin, consumption: [], balance: startBalance });
  writeData(data);
  res.json({ success: true });
});
// Guthaben abfragen
router.get('/balance/:username', (req, res) => {
  const data = readData();
  const user = data.users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  res.json({ balance: user.balance || 0 });
});

// Geld einzahlen
router.post('/deposit', (req, res) => {
  console.log('[DEPOSIT] ========== DEPOSIT REQUEST ==========');
  console.log('[DEPOSIT] Body:', JSON.stringify(req.body, null, 2));
  
  const { username, amount } = req.body;
  
  // Basis-Validierung
  if (!username) {
    console.log('[DEPOSIT] ERROR: No username provided');
    return res.status(400).json({ error: 'Kein Username angegeben' });
  }
  
  if (typeof amount !== 'number' || amount <= 0) {
    console.log('[DEPOSIT] ERROR: Invalid amount:', amount, 'type:', typeof amount);
    return res.status(400).json({ error: 'Ungültiger Betrag' });
  }
  
  // Betrag auf 2 Dezimalstellen runden
  const roundedAmount = roundToTwoDecimals(amount);
  
  console.log('[DEPOSIT] Username:', username);
  console.log('[DEPOSIT] Amount to deposit (original):', amount);
  console.log('[DEPOSIT] Amount to deposit (rounded):', roundedAmount);
  console.log('[DEPOSIT] MAX_USER_BALANCE:', MAX_USER_BALANCE);
  
  try {
    // Daten laden (mit automatischer Rundung)
    const data = readData();
    console.log('[DEPOSIT] Data loaded successfully');
    
    const user = data.users.find(u => u.username === username);
    if (!user) {
      console.log('[DEPOSIT] ERROR: User not found:', username);
      return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    }
    
    const currentBalance = roundToTwoDecimals(user.balance || 0);
    const newBalance = roundToTwoDecimals(currentBalance + roundedAmount);
    
    console.log('[DEPOSIT] Current balance:', currentBalance);
    console.log('[DEPOSIT] New balance would be:', newBalance);
    console.log('[DEPOSIT] Limit:', MAX_USER_BALANCE);
    console.log('[DEPOSIT] Would exceed limit?', newBalance > MAX_USER_BALANCE);
    
    // LIMIT PRÜFUNG - DIREKT UND EINFACH
    if (newBalance > MAX_USER_BALANCE) {
      const errorMsg = `LIMIT ÜBERSCHRITTEN! Maximum: ${MAX_USER_BALANCE}€, aktuell: ${currentBalance}€, nach Einzahlung: ${newBalance}€`;
      console.log('[DEPOSIT] ❌❌❌', errorMsg);
      return res.status(400).json({ error: errorMsg });
    }
    
    // Transaktion durchführen
    user.balance = newBalance;
    if (!Array.isArray(user.consumption)) user.consumption = [];
    user.consumption.push({ 
      date: new Date().toISOString(), 
      amount: roundedAmount, 
      type: 'deposit', 
      description: 'Einzahlung' 
    });
    
    writeData(data);
    console.log('[DEPOSIT] ✅✅✅ SUCCESS! New balance:', user.balance);
    res.json({ success: true, balance: user.balance });
    
  } catch (error) {
    console.log('[DEPOSIT] ❌ EXCEPTION:', error);
    res.status(500).json({ error: 'Server Fehler: ' + error.message });
  }
});

router.post('/login', (req, res) => {
  const { username, pin } = req.body;
  const data = readData();
  const user = data.users.find(u => u.username === username && u.pin === pin);
  if (!user) return res.status(401).json({ error: 'Login fehlgeschlagen' });
  res.json({ success: true });
});

router.get('/consumption/:username', (req, res) => {
  const data = readData();
  const user = data.users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  res.json(user.consumption);
});

router.post('/consume', (req, res) => {
  const { username, drink } = req.body;
  const data = readData();
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  const drinkObj = data.drinks.find(d => d.name === drink);
  if (!drinkObj) return res.status(400).json({ error: 'Getränk nicht gefunden' });
  const price = drinkObj.price;
  const newBalance = (user.balance || 0) - price;
  if (newBalance < -10) {
    return res.status(400).json({ error: 'Kohle her' });
  }
  user.balance = newBalance;
  // push transaction (negative amount for purchase)
  if (!Array.isArray(user.consumption)) user.consumption = [];
  user.consumption.push({ date: new Date().toISOString(), amount: -price, type: 'purchase', description: drink });
  writeData(data);
  res.json({ success: true, balance: user.balance });
});

// Transfer: von einem Nutzer zu einem anderen
router.post('/transfer', (req, res) => {
  console.log('[TRANSFER] Request received:', req.body);
  const { from, to, amount } = req.body;
  if (!from || !to || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Ungültige Eingabe' });
  }
  
  const data = readData();
  const sender = data.users.find(u => u.username === from);
  const receiver = data.users.find(u => u.username === to);
  if (!sender || !receiver) {
    return res.status(404).json({ error: 'Sender oder Empfänger nicht gefunden' });
  }
  
  // Sender-Guthaben prüfen
  const newSenderBal = (sender.balance || 0) - amount;
  if (newSenderBal < -10) {
    return res.status(400).json({ error: 'Nicht genug Guthaben' });
  }
  
  // Empfänger-Limit prüfen
  const receiverBalance = roundToTwoDecimals(receiver.balance || 0);
  const newReceiverBalance = roundToTwoDecimals(receiverBalance + amount);
  
  console.log('[TRANSFER] Receiver current balance:', receiverBalance);
  console.log('[TRANSFER] Transfer amount:', amount);
  console.log('[TRANSFER] Receiver new balance would be:', newReceiverBalance);
  console.log('[TRANSFER] Max allowed:', MAX_USER_BALANCE);
  
  if (newReceiverBalance > MAX_USER_BALANCE) {
    const errorMsg = `Empfänger-Limit überschritten! Maximum: ${MAX_USER_BALANCE}€, aktuell: ${receiverBalance}€, nach Überweisung: ${newReceiverBalance}€`;
    console.log('[TRANSFER] ❌', errorMsg);
    return res.status(400).json({ error: errorMsg });
  }
  
  // Transaktion durchführen
  sender.balance = newSenderBal;
  receiver.balance = newReceiverBalance;
  
  if (!Array.isArray(sender.consumption)) sender.consumption = [];
  if (!Array.isArray(receiver.consumption)) receiver.consumption = [];
  
  const now = new Date().toISOString();
  sender.consumption.push({ date: now, amount: -amount, type: 'transfer', description: `Gesendet an ${to}` });
  receiver.consumption.push({ date: now, amount: amount, type: 'transfer', description: `Erhalten von ${from}` });
  
  writeData(data);
  console.log('[TRANSFER] ✅ Transfer successful');
  res.json({ success: true, balance: sender.balance });
});

// --- Admin ---
router.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const data = readData();
  if (data.admin.password !== password) return res.status(401).json({ error: 'Falsches Passwort' });
  res.json({ success: true });
});

router.post('/admin/password', (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const data = readData();
  if (data.admin.password !== oldPassword) return res.status(401).json({ error: 'Falsches Passwort' });
  data.admin.password = newPassword;
  writeData(data);
  res.json({ success: true });
});

router.get('/admin/drinks', (req, res) => {
  const data = readData();
  res.json(data.drinks);
});

router.post('/admin/drinks', (req, res) => {
  const { name, price } = req.body;
  const data = readData();
  if (!name || typeof price !== 'number') return res.status(400).json({ error: 'Ungültige Eingabe' });
  data.drinks.push({ name, price });
  writeData(data);
  res.json({ success: true });
});

router.delete('/admin/drinks/:name', (req, res) => {
  const data = readData();
  data.drinks = data.drinks.filter(d => d.name !== req.params.name);
  writeData(data);
  res.json({ success: true });
});

// Timer-Status abrufen
router.get('/admin/timer-status', (req, res) => {
  const data = readData();
  const timersDisabled = data.admin.timersDisabled || false;
  res.json({ timersDisabled });
});

// Timer-Status umschalten
router.post('/admin/timer-toggle', (req, res) => {
  const data = readData();
  data.admin.timersDisabled = !data.admin.timersDisabled;
  writeData(data);
  res.json({ 
    success: true, 
    timersDisabled: data.admin.timersDisabled 
  });
});

module.exports = router;
