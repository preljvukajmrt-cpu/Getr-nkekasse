
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

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
  if (typeof balance === 'number' && balance >= 0) startBalance = balance;
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
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Ungültige Eingabe' });
  }
  const data = readData();
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  user.balance = (user.balance || 0) + amount;
  // push transaction (positive amount for deposit)
  if (!Array.isArray(user.consumption)) user.consumption = [];
  user.consumption.push({ date: new Date().toISOString(), amount: amount, type: 'deposit', description: 'Einzahlung' });
  writeData(data);
  res.json({ success: true, balance: user.balance });
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
  const { from, to, amount } = req.body;
  if (!from || !to || typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Ungültige Eingabe' });
  const data = readData();
  const sender = data.users.find(u => u.username === from);
  const receiver = data.users.find(u => u.username === to);
  if (!sender || !receiver) return res.status(404).json({ error: 'Sender oder Empfänger nicht gefunden' });
  // prüfe Limits
  const newSenderBal = (sender.balance || 0) - amount;
  if (newSenderBal < -10) return res.status(400).json({ error: 'Nicht genug Guthaben' });
  sender.balance = newSenderBal;
  receiver.balance = (receiver.balance || 0) + amount;
  if (!Array.isArray(sender.consumption)) sender.consumption = [];
  if (!Array.isArray(receiver.consumption)) receiver.consumption = [];
  const now = new Date().toISOString();
  sender.consumption.push({ date: now, amount: -amount, type: 'transfer', description: `Gesendet an ${to}` });
  receiver.consumption.push({ date: now, amount: amount, type: 'transfer', description: `Erhalten von ${from}` });
  writeData(data);
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
