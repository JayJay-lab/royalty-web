# Royalty Manager frontend

This frontend is matched to the `MusicRoyaltyApi` backend supplied with the project.

## Backend routes used

Client:
- `POST /api/auth/login`
- `POST /api/users`
- `GET /api/users/{id}/balance`
- `POST /api/users/{id}/tracks`
- `PUT /api/users/{id}`
- `GET/POST/PUT/DELETE /api/data/...`
- `GET /api/lookup/roles`

Admin:
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/users...`
- `/api/revenue/...`
- `/api/reports/...`
- `/api/tables...`
- `/api/data/...`
- `POST /api/tables/import`

The old client code called `/api/client/...` endpoints that do not exist in this backend. This version removes those calls.

## Run it

### Terminal 1 — backend

```powershell
cd "C:\Users\Admin\Documents\second semester\Sir Serutla projects\MusicRoyaltyBackend\MusicRoyaltyApi"
dotnet run
```

The Vite proxy expects the API at:

```text
http://localhost:5220
```

### Terminal 2 — frontend

```powershell
cd "C:\Users\Admin\Documents\second semester\Sir Serutla projects\MusicRoyaltyBackend\royalty-web"
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Client flow

1. Sign up.
2. Enter full name, email, bank name, account number and branch code.
3. Artist name and Spotify ID are optional.
4. After successful signup, the frontend logs the new user in automatically.
5. Dashboard shows balance and payouts.
6. My tracks loads tracks/contributions through the existing generic `/api/data` endpoint.
7. Upload a track and its contributors through `POST /api/users/{id}/tracks`.
8. Profile updates user details and bank accounts.

## Important

The supplied backend ZIP does not contain a `PlaysController.cs` or another plays-generator controller. Therefore this frontend does not invent a plays-generator endpoint. If the plays generator is in a different backend copy, that controller can be integrated separately.
