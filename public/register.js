document.getElementById('reg-submit').onclick = async function() {
  const username = document.getElementById('reg-username').value.trim();
  const pin = document.getElementById('reg-pin').value.trim();
  const balance = parseFloat(document.getElementById('reg-balance').value);
  const msg = document.getElementById('reg-message');
  if (!username || pin.length !== 4 || isNaN(balance) || balance < 0) {
    msg.textContent = 'Bitte alle Felder korrekt ausfüllen!';
    msg.style.color = '#ff4136';
    return;
  }
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin, balance })
  });
  const data = await res.json();
  if (data.success) {
    msg.textContent = 'Registrierung erfolgreich! Du kannst dich jetzt einloggen.';
    msg.style.color = 'green';
    setTimeout(() => window.location.href = 'index.html', 1200);
  } else {
    msg.textContent = data.error || 'Fehler bei der Registrierung.';
    msg.style.color = '#ff4136';
  }
};
