# Bitespeed Backend Task: Identity Reconciliation

A web service that identifies and links customer contacts across multiple purchases. Orders from FluxKart.com always have either `email` or `phoneNumber` at checkout; this service reconciles them into a single identity with one primary contact and optional secondary contacts.

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express
- **Database:** SQLite (via better-sqlite3)

## Requirements Met

- **POST /identify** endpoint that accepts `email` and/or `phoneNumber`
- Contact table with: `id`, `phoneNumber`, `email`, `linkedId`, `linkPrecedence`, `createdAt`, `updatedAt`, `deletedAt`
- Primary contact: first contact in a link; secondary contacts link to it via `linkedId`
- New customer → create primary contact, return with empty `secondaryContactIds`
- Same customer with new info → create secondary contact linked to primary
- Two separate links merged (e.g. same email + same phone from different contacts) → older stays primary, newer becomes secondary
- Response format: `primaryContatctId`, `emails` (primary first), `phoneNumbers` (primary first), `secondaryContactIds`

## Setup

```bash
npm install
```

## Run

```bash
npm run dev    # Development (tsx watch)
npm run build
npm start      # Production
```

Server runs at **http://localhost:3000** (or `PORT` env).

## API

### POST /identify

**Request body (JSON):**

| Field        | Type   | Required |
|-------------|--------|----------|
| `email`     | string | No*      |
| `phoneNumber` | string or number | No*  |

*At least one of `email` or `phoneNumber` is required.

**Example request:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Example response (200):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

- **primaryContatctId:** ID of the primary contact for this identity
- **emails:** All emails in the link; first is the primary contact’s email
- **phoneNumbers:** All phone numbers in the link; first is the primary contact’s phoneNumber
- **secondaryContactIds:** IDs of all secondary contacts in the link

**Error (400):** Missing both `email` and `phoneNumber`, or invalid body.

## Test

```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/identify" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","phoneNumber":"123456"}' | ConvertTo-Json -Depth 5
```

```bash
# curl
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"phoneNumber\":\"123456\"}"
```

## Project Structure

```
src/
  index.ts    # Express server, POST /identify route
  identify.ts # Identity reconciliation logic
  db.ts       # SQLite connection and Contact table
  types.ts    # Request/response and Contact types
```

Database file: `contacts.db` (created in project root on first run).
