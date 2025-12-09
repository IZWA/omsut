OMSUT Server
==============

This is a minimal Node/Express backend for the OMSUT game. It provides:

- User registration & login (JWT)
- Profile (display name, photo upload)
- Badges and awarding badges to users

Quick start
-----------

Requirements: Node.js 16+ and npm

From `s:\MOTUS\server`:

1. Install dependencies

```powershell
npm install
```

2. Set a JWT secret (recommended)

In PowerShell:

```powershell
$env:OMSUT_JWT_SECRET = 'your_secret_here'
```

3. Start the server

```powershell
npm start
```

The server listens on port 3000 by default. API root: `http://localhost:3000/api/`.

Endpoints (summary)
- `POST /api/register` {username,password,displayName}
- `POST /api/login` {username,password} -> {token}
- `GET /api/profile` (Authorization: Bearer <token>)
- `PUT /api/profile` (Authorization) {display_name}
- `POST /api/profile/photo` (Authorization) multipart form file field `photo`
- `POST /api/users/:id/badges/:badgeId` (award badge)

Notes
- Photos are stored in `server/uploads` and served at `/uploads/<filename>`.
- The DB is a SQLite file `server/omsut.db` created automatically.
