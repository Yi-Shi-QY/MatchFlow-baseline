# Match Data Server Deployment Guide

This is a production-ready Node.js/Express server that provides match data for the MatchFlow application. It supports both in-memory mock data (for testing) and PostgreSQL (for production).

## Features

- **Hybrid Storage**: Uses PostgreSQL if `DATABASE_URL` is provided, otherwise falls back to mock data.
- **Data Injection API**: Admin endpoints to push teams and matches via HTTP.
- **Docker Support**: Includes `docker-compose.yml` for one-click deployment.

## Quick Start (Docker Compose)

The easiest way to run the server and database is using Docker Compose.

1.  **Configure Environment**:
    - Copy `.env.example` to `.env`.
    - Set `API_KEY` to a strong secret.

2.  **Start Services**:
    ```bash
    docker-compose up -d
    ```
    This will start:
    - PostgreSQL database on port 5432
    - Match Data Server on port 3001

3.  **Initialize Database**:
    The first time you run it, you need to create the tables. You can do this by running the example script:
    ```bash
    node scripts/push_data_example.js
    ```
    Or manually calling the init endpoint:
    ```bash
    curl -X POST http://localhost:3001/admin/init \
      -H "Authorization: Bearer <YOUR_API_KEY>"
    ```

## Manual Deployment

### Prerequisites
- Node.js (v18+)
- PostgreSQL (optional, if using DB mode)

### Steps
1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configuration**:
    - Set `PORT` (default: 3001).
    - Set `API_KEY`.
    - Set `DATABASE_URL` (e.g., `postgresql://user:pass@localhost:5432/db`).

3.  **Run Server**:
    ```bash
    npm start
    ```

## Data Management (How to add matches)

Instead of writing SQL manually, you can use the Admin API to push data. This allows you to write scripts in any language (Python, JS, etc.) to scrape data from other sources and push it to your server.

### Example Script
See `scripts/push_data_example.js` for a complete example using Node.js `fetch`.

### Admin Endpoints
All admin endpoints require `Authorization: Bearer <API_KEY>`.

1.  **Initialize DB**: `POST /admin/init`
2.  **Upsert Team**: `POST /admin/teams`
    - Body: `{ "name": "Arsenal", "logo_url": "...", "recent_form": ["W", "L"] }`
    - Returns: `{ "data": { "id": "uuid", ... } }`
3.  **Upsert Match**: `POST /admin/matches`
    - Body: `{ "league_name": "...", "match_date": "...", "home_team_id": "uuid", "away_team_id": "uuid", ... }`

## API Usage (For MatchFlow App)

Configure your MatchFlow app settings:
- **Server URL**: `http://localhost:3001` (or your production URL)
- **API Key**: The value you set in `.env`.
