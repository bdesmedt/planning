# Rooster Planning Backend

Backend API voor het Personeelsplanning & Roostersysteem.

## Deploy naar Railway

1. Ga naar [Railway](https://railway.app)
2. Klik op "New Project" → "Deploy from GitHub repo"
3. Selecteer `bdesmedt/planning`
4. Voeg environment variables toe:
   - `JWT_SECRET`: Een lange random string (bijv. `mijn-super-geheime-sleutel-2024`)
   - `FRONTEND_URL`: `https://rooster-planning.netlify.app`
5. Railway deployt automatisch!
6. Kopieer de Railway URL en update de Netlify environment variable

## Demo Accounts

- Manager: `admin@winkel.nl` / `admin123`
- Medewerker: `jan@winkel.nl` / `demo123`
