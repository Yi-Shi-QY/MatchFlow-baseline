# Match Data Server Deployment Guide

This is a simple Node.js/Express server that provides match data for the MatchFlow application.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Local Development

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configuration**:
    - Copy `.env.example` to `.env`.
    - Set your desired `PORT` (default: 3001).
    - Set a strong `API_KEY`. This key will be used by the MatchFlow app to authenticate requests.

3.  **Run Server**:
    ```bash
    npm run dev
    ```
    The server will start at `http://localhost:3001`.

## Deployment (Production)

You can deploy this server to any platform that supports Node.js, such as:

- **Render / Railway / Heroku**:
    - Connect your repository.
    - Set the build command to `npm install`.
    - Set the start command to `npm start`.
    - Add environment variables `PORT` and `API_KEY` in the platform's dashboard.

- **VPS (Ubuntu/Debian)**:
    - Install Node.js and PM2: `npm install -g pm2`.
    - Clone the repo and install dependencies.
    - Start with PM2: `pm2 start index.js --name match-server`.
    - Configure Nginx as a reverse proxy if needed.

## API Usage

Once deployed, configure your MatchFlow app settings:

- **Server URL**: `https://your-deployed-server.com` (or `http://localhost:3001` for local testing)
- **API Key**: The value you set in `.env`.

### Endpoints

- `GET /health`: Check if server is running.
- `GET /matches`: Get list of matches. Supports query params `date` (YYYY-MM-DD) and `status` (live/upcoming/finished). Requires `Authorization: Bearer <API_KEY>`.
- `GET /matches/:id`: Get details of a specific match. Requires `Authorization: Bearer <API_KEY>`.
