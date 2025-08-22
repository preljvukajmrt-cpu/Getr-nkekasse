# Getränkekasse

This small web app implements a Getränkekasse (drink fund) for the Toolbox Verein in Markdorf. It provides a simple interface for members to register drinks, track balances, and for an admin to manage the fund.

## Features


- Register members and record drink purchases
- Track each member's balance
- Simple admin view to manage entries and reset the fund
- Static, lightweight frontend served from the `public/` folder

## Tech stack

- Node.js (Express) backend (`app.js`, `routes/api.js`)
- Static frontend in `public/` (HTML, CSS, JS)
- Data stored in `data.json` for simplicity

## Who it's for

This Getränkekasse installation is intended for the Toolbox Verein in Markdorf — a local community/toolbox association. Use it to simplify collecting and tracking contributions for drinks during meetings and events.

## Quick start

1. Install dependencies

```bash
npm install
```

2. Start the app

```bash
npm start
```

3. Open in your browser

```
http://localhost:3000/
```

## Project layout

- `app.js` — Express app entry
- `routes/api.js` — API endpoints
- `data.json` — Simple JSON store for members and transactions
- `public/` — Frontend files (index, admin, register pages)

## Notes & next steps

- This project uses a flat `data.json` file. For production or multi-user setups consider migrating to a real database (SQLite, PostgreSQL).
- Add authentication for the admin area if needed.

If you'd like, I can add a short admin password, convert `data.json` to a SQLite DB, or generate deployment instructions — tell me which next step you'd prefer.
# Getr-nkekasse
