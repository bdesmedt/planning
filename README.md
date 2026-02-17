# Rooster Planning Backend

Backend API voor het Personeelsplanning & Roostersysteem.

## Installatie

```bash
npm install
```

## Configuratie

Maak een `.env` bestand aan:

```
PORT=3001
JWT_SECRET=jouw-geheime-sleutel-hier
FRONTEND_URL=https://rooster-planning.netlify.app
```

## Starten

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

- `POST /api/auth/login` - Inloggen
- `GET /api/auth/me` - Huidige gebruiker
- `GET /api/shifts` - Diensten ophalen
- `POST /api/shifts` - Dienst aanmaken
- `GET /api/leave-requests` - Verlofaanvragen
- etc.

## Demo Accounts

- Manager: `admin@winkel.nl` / `admin123`
- Medewerker: `jan@winkel.nl` / `demo123`

## Deploy naar Railway

1. Fork deze repository
2. Ga naar [Railway](https://railway.app)
3. Klik op "New Project" → "Deploy from GitHub repo"
4. Selecteer deze repository
5. Voeg environment variables toe:
   - `JWT_SECRET`: Een lange random string
   - `FRONTEND_URL`: https://rooster-planning.netlify.app
6. Railway deployt automatisch!
