// Admin-Passwort ändern
$("change-password-btn").onclick = async function() {
	const oldPassword = $("old-admin-password").value;
	const newPassword = $("new-admin-password").value;
	const msg = $("password-message");
	if (!oldPassword || !newPassword) {
		msg.textContent = "Bitte beide Felder ausfüllen.";
		msg.style.color = "#ff4136";
		return;
	}
	const res = await fetch('/api/admin/password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ oldPassword, newPassword })
	});
	const data = await res.json();
	if (data.success) {
		msg.textContent = "Passwort erfolgreich geändert.";
		msg.style.color = "green";
		$("old-admin-password").value = "";
		$("new-admin-password").value = "";
	} else {
		msg.textContent = data.error || "Fehler beim Ändern.";
		msg.style.color = "#ff4136";
	}
};

// Hilfsfunktion
function $(id) { return document.getElementById(id); }

// Admin-Login
$("admin-login-btn").onclick = async function() {
	const password = $("admin-password").value;
	const res = await fetch("/api/admin/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password })
	});
	const data = await res.json();
	if (data.success) {
		$("admin-login-section").style.display = "none";
		$("admin-main-section").style.display = "block";
		loadAdminDrinks();
		loadTimerStatus();
		showTab("password"); // Default to password tab
	} else {
		$("admin-login-message").textContent = data.error || "Login fehlgeschlagen.";
		$("admin-login-message").style.color = "#ff6b6b";
	}
};

// Tabs
function showTab(tab) {
	$("password-section").style.display = tab === "password" ? "block" : "none";
	$("debug-section").style.display = tab === "debug" ? "block" : "none";
	// Drinks section is always visible now
}
$("tab-password").onclick = () => showTab("password");
$("tab-debug").onclick = () => showTab("debug");

// Timer-Status laden
async function loadTimerStatus() {
	try {
		const res = await fetch("/api/admin/timer-status");
		const data = await res.json();
		updateTimerButton(data.timersDisabled);
	} catch (error) {
		console.error("Fehler beim Laden des Timer-Status:", error);
	}
}

// Timer-Button aktualisieren
function updateTimerButton(timersDisabled) {
	const btn = $("timer-toggle-btn");
	const status = $("timer-status");
	
	if (timersDisabled) {
		btn.textContent = "Timer an";
		btn.className = "timer-btn-on";
		status.textContent = "Status: Timer gestoppt";
	} else {
		btn.textContent = "Timer aus";
		btn.className = "timer-btn-off";
		status.textContent = "Status: Timer laufen";
	}
}

// Timer-Toggle-Button
$("timer-toggle-btn").onclick = async function() {
	try {
		const res = await fetch("/api/admin/timer-toggle", {
			method: "POST",
			headers: { "Content-Type": "application/json" }
		});
		const data = await res.json();
		if (data.success) {
			updateTimerButton(data.timersDisabled);
		} else {
			alert("Fehler beim Umschalten der Timer: " + (data.error || "Unbekannter Fehler"));
		}
	} catch (error) {
		console.error("Fehler beim Umschalten der Timer:", error);
		alert("Fehler beim Umschalten der Timer");
	}
};


// Logout
$("admin-logout-btn").onclick = function() {
	// Auch User ausloggen
	window.localStorage.removeItem("username");
	$("admin-main-section").style.display = "none";
	$("admin-login-section").style.display = "block";
	$("admin-password").value = "";
	$("admin-login-message").textContent = "";
	// Nach Logout zurück zum Startfenster
	window.location.href = "/index.html";
};


// Getränke laden (Admin) - Neue Tabellen-Version
let drinksData = [];
let changedDrinks = new Set();

async function loadAdminDrinks() {
	try {
		const res = await fetch("/api/admin/drinks");
		drinksData = await res.json();
		renderDrinksTable();
	} catch (error) {
		console.error('Fehler beim Laden der Getränke:', error);
	}
}

function renderDrinksTable() {
	const tbody = $("drinks-table-body");
	tbody.innerHTML = "";
	
	drinksData.forEach(drink => {
		const row = document.createElement("tr");
		row.dataset.drinkId = drink.id;
		
		if (changedDrinks.has(drink.id)) {
			row.classList.add('changed-row');
		}
		
		row.innerHTML = `
			<td class="editable-cell" data-field="name" data-drink-id="${drink.id}">${drink.name}</td>
			<td class="editable-cell" data-field="price" data-drink-id="${drink.id}">${drink.price.toFixed(2)}</td>
			<td class="barcode-cell">${drink.barcode || '<span style="color:#adb5bd;">Kein Barcode</span>'}</td>
			<td>
				<button class="action-btn barcode-btn" onclick="openBarcodeScanner(${drink.id})" style="background:#0074D9;margin-right:0.5em;">Barcode</button>
				<button class="action-btn" onclick="deleteDrink(${drink.id})">Löschen</button>
			</td>
		`;
		
		tbody.appendChild(row);
	});
	
	// Add click handlers for editable cells
	document.querySelectorAll('.editable-cell').forEach(cell => {
		cell.addEventListener('click', startEdit);
	});
	
	// Update save button state
	updateSaveButtonState();
}

function openBarcodeScanner(drinkId) {
	const drink = drinksData.find(d => d.id === drinkId);
	if (drink) {
		window.open(`/barcode-scanner.html?drinkId=${drinkId}`, '_blank', 'width=900,height=700');
	}
}

function updateSaveButtonState() {
	const saveBtn = $("save-drinks-btn");
	const hasChanges = changedDrinks.size > 0;
	
	saveBtn.disabled = !hasChanges;
	saveBtn.textContent = hasChanges 
		? `${changedDrinks.size} Änderung(en) speichern` 
		: "Änderungen speichern";
}

function startEdit(event) {
	const cell = event.target;
	if (cell.classList.contains('editing')) return;
	
	const originalValue = cell.textContent;
	const field = cell.dataset.field;
	
	cell.classList.add('editing');
	
	let input;
	if (field === 'price') {
		input = document.createElement('input');
		input.type = 'number';
		input.step = '0.01';
		input.min = '0';
		input.value = parseFloat(originalValue);
	} else {
		input = document.createElement('input');
		input.type = 'text';
		input.value = originalValue;
	}
	
	cell.innerHTML = '';
	cell.appendChild(input);
	input.focus();
	
	function finishEdit() {
		const newValue = input.value.trim();
		const drinkId = parseInt(cell.dataset.drinkId);
		
		cell.classList.remove('editing');
		
		if (newValue !== originalValue && newValue !== '') {
			// Update data
			const drink = drinksData.find(d => d.id === drinkId);
			if (drink) {
				if (field === 'price') {
					drink.price = parseFloat(newValue);
					cell.textContent = parseFloat(newValue).toFixed(2);
				} else {
					drink.name = newValue;
					cell.textContent = newValue;
				}
				
				// Mark as changed
				changedDrinks.add(drinkId);
				cell.closest('tr').classList.add('changed-row');
				updateSaveButtonState();
			}
		} else {
			// Restore original value
			cell.textContent = originalValue;
		}
	}
	
	input.addEventListener('blur', finishEdit);
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			finishEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cell.classList.remove('editing');
			cell.textContent = originalValue;
		}
	});
}

async function saveDrinksChanges() {
	const changedDrinksData = drinksData.filter(drink => changedDrinks.has(drink.id));
	
	try {
		const res = await fetch('/api/admin/drinks', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ drinks: changedDrinksData })
		});
		
		const data = await res.json();
		if (data.success) {
			changedDrinks.clear();
			renderDrinksTable();
			alert('Änderungen erfolgreich gespeichert!');
		} else {
			alert('Fehler beim Speichern: ' + (data.error || 'Unbekannter Fehler'));
		}
	} catch (error) {
		console.error('Fehler beim Speichern:', error);
		alert('Fehler beim Speichern der Änderungen');
	}
}

async function deleteDrink(drinkId) {
	if (!confirm('Möchten Sie dieses Getränk wirklich löschen?')) {
		return;
	}
	
	try {
		const res = await fetch(`/api/admin/drinks/id/${drinkId}`, {
			method: 'DELETE'
		});
		
		const data = await res.json();
		if (data.success) {
			// Remove from local data
			drinksData = drinksData.filter(drink => drink.id !== drinkId);
			changedDrinks.delete(drinkId);
			renderDrinksTable();
		} else {
			alert('Fehler beim Löschen: ' + (data.error || 'Unbekannter Fehler'));
		}
	} catch (error) {
		console.error('Fehler beim Löschen:', error);
		alert('Fehler beim Löschen des Getränks');
	}
}

// Save button handler
$("save-drinks-btn").onclick = saveDrinksChanges;

// Getränk hinzufügen
$("add-drink-btn").onclick = async function() {
	const name = $("new-drink-name").value.trim();
	const price = parseFloat($("new-drink-price").value);
	if (!name || isNaN(price)) {
		alert("Bitte Name und Preis eingeben.");
		return;
	}
	const res = await fetch("/api/admin/drinks", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, price })
	});
	const data = await res.json();
	if (data.success) {
		$("new-drink-name").value = "";
		$("new-drink-price").value = "";
		loadAdminDrinks(); // Reload table
	} else {
		alert(data.error || "Fehler beim Hinzufügen.");
	}
};
