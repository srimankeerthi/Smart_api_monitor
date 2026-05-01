#  Smart API Monitor

Production-ready API health monitoring system built with Node.js, Express, MongoDB, and Redis.

---
## Folder Structure

```
smart-api-monitor/
├── src/
│   ├── app.js                    # Express app factory (middleware + routes)
│   ├── server.js                 # Entry point (DB, Redis, scheduler, HTTP)
│   ├── config/
│   │   ├── database.js           # MongoDB connection with retry logic
│   │   └── redis.js              # ioredis singleton + cache helpers
│   ├── controllers/
│   │   ├── apiController.js      # CRUD for monitored APIs + manual ping
│   │   └── dashboardController.js# /stats, /logs, /alerts, resolve alert
│   ├── jobs/
│   │   └── monitorScheduler.js   # node-cron scheduler (pings due APIs)
│   ├── middleware/
│   │   ├── errorHandler.js       # Global error + 404 handlers
│   │   ├── rateLimiter.js        # express-rate-limit
│   │   └── requestLogger.js      # Morgan → Winston
│   ├── models/
│   │   ├── Alert.js              # Fired alerts
│   │   ├── MonitoredApi.js       # Registered API endpoints
│   │   └── PingLog.js            # Per-ping audit log (TTL: 30 days)
│   ├── routes/
│   │   ├── apiRoutes.js          # /apis/* routes
│   │   └── dashboardRoutes.js    # /stats /logs /alerts routes
│   ├── services/
│   │   ├── alertService.js       # Alert threshold logic + notification dispatch
│   │   └── pingService.js        # Core ping engine (axios + result recording)
│   └── utils/
│       ├── logger.js             # Winston (console + file)
│       └── response.js           # Standardised JSON response helpers
├── logs/                         # Auto-created: combined.log, error.log
├── .env.example                  # Copy → .env and fill in values
├── package.json
└── README.md
```
## 📊 Dashboard Overview

<img width="1067" height="727" alt="Screenshot 2026-05-01 152652" src="https://github.com/user-attachments/assets/41752111-104e-4edd-ad2f-496b21239f5a" />


### 🧠 What this shows

* Real-time API health monitoring
* Service status tracking (Operational / Down / Maintenance)
* Latency visualization
* Uptime tracking

---

## 🚨 Incident Monitoring & Live Feed

<img width="1070" height="722" alt="Screenshot 2026-05-01 152742" src="https://github.com/user-attachments/assets/1e9a2054-e1e7-4b22-9a40-32f54764f303" />

### ⚡ Features

* Live incident feed
* Error detection (timeouts, delays)
* Timestamped alerts
* System status updates

---

## 📌 Project Highlights

* 📡 Real-time API monitoring system
* 📊 Performance tracking (latency + uptime)
* 🚨 Incident detection & logging
* ⚡ Multi-service comparison
* 🔄 Auto-refresh dashboard

---
Monitoring Capabilities
📡 Continuous API health checks
📊 Latency & performance visualization
📉 Uptime tracking & stability analysis
⚡ Multi-service comparison
🚨 Incident detection and logging
---
⚙️ System Design (Simple Flow)
APIs are monitored at regular intervals
Metrics are stored in database/cache
Backend processes health & latency data
Frontend fetches and displays live updates
---
## 🏷️ Badges



This dashboard gives a complete overview of system health and performance similar to tools like UptimeRobot or Datadog.
![Status](https://img.shields.io/badge/status-active-success)
![Node](https://img.shields.io/badge/backend-nodejs-green)
![Monitoring](https://img.shields.io/badge/type-monitoring-blue)



---

##  Quick Start

### Prerequisites
- Node.js ≥ 20
- MongoDB (local or Atlas)
- Redis (local or Redis Cloud)

### 1 — Clone & Install
```bash
git clone <repo-url>
cd smart-api-monitor
npm install
```

### 2 — Configure Environment
```bash
cp .env.example .env
# Edit .env — set MONGO_URI and REDIS_HOST at minimum
```

### 3 — Start Services (local dev)
```bash
# MongoDB
mongod --dbpath ./data/db

# Redis
redis-server
```

### 4 — Run the App
```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Server starts at **http://localhost:3000**

---

##  API Reference

| Method | Endpoint               | Description                          |
|--------|------------------------|--------------------------------------|
| GET    | /health                | Health check                         |
| POST   | /apis                  | Register an API to monitor           |
| GET    | /apis                  | List all registered APIs             |
| GET    | /apis/:id              | Get a single API                     |
| PUT    | /apis/:id              | Update an API                        |
| DELETE | /apis/:id              | Delete an API                        |
| POST   | /apis/:id/ping         | Trigger an immediate ping            |
| GET    | /stats?hours=24        | Uptime % + avg latency per API       |
| GET    | /logs                  | Paginated ping logs                  |
| GET    | /alerts                | Paginated alerts                     |
| PATCH  | /alerts/:id/resolve    | Resolve an alert                     |

---

## 📬 Postman Testing Steps

### Step 1 — Health Check
```
GET http://localhost:3000/health
```
Expected: `{ "status": "ok", "uptime": ... }`

---

### Step 2 — Register an API
```
POST http://localhost:3000/apis
Content-Type: application/json

{
  "name": "JSONPlaceholder Posts",
  "url": "https://jsonplaceholder.typicode.com/posts/1",
  "method": "GET",
  "expectedResponseTimeMs": 1500,
  "intervalMinutes": 1
}
```
Save the returned `_id` as `API_ID`.

---

### Step 3 — Register an API that will fail (for alert testing)
```json
{
  "name": "Broken API",
  "url": "https://this-domain-does-not-exist-xyz.com/api",
  "method": "GET",
  "expectedResponseTimeMs": 500,
  "intervalMinutes": 1
}
```

---

### Step 4 — Trigger manual pings
```
POST http://localhost:3000/apis/API_ID/ping
```
Repeat 3× on the broken API to trigger an alert.

---

### Step 5 — View stats
```
GET http://localhost:3000/stats?hours=1
```

---

### Step 6 — View logs
```
GET http://localhost:3000/logs
GET http://localhost:3000/logs?status=down&limit=10
GET http://localhost:3000/logs?apiId=API_ID
```

---

### Step 7 — View & resolve alerts
```
GET  http://localhost:3000/alerts?resolved=false
PATCH http://localhost:3000/alerts/ALERT_ID/resolve
```

---

##  Alert System

- **Threshold**: `ALERT_FAILURE_THRESHOLD` consecutive failures (default: 3)
- **Channels**: Console log is always active. Email and Slack are ready-to-uncomment in `alertService.js`
- Alerts fire exactly once per failure streak (not on every subsequent failure)
- Resolve via `PATCH /alerts/:id/resolve`

---

##  Docker Setup

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### docker-compose.yml
```yaml
version: '3.9'
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [mongo, redis]
    restart: unless-stopped

  mongo:
    image: mongo:7
    volumes: [mongo_data:/data/db]
    ports: ["27017:27017"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  mongo_data:
```

```bash
docker compose up --build
```

---

## ☁️ Scaling on AWS

| Component | Service | Notes |
|-----------|---------|-------|
| App server | ECS Fargate / EC2 | Multiple tasks behind ALB |
| MongoDB | DocumentDB / Atlas | Replica set for HA |
| Redis | ElastiCache (Redis) | Cluster mode for scale |
| Logs | CloudWatch Logs | Stream Winston logs |
| Alerts | SNS + SES | Replace console channel in alertService.js |
| Secrets | Secrets Manager | Pull .env values at runtime |
| CI/CD | CodePipeline / GitHub Actions | Automate builds + deploys |

### Horizontal scaling notes
- The scheduler should run on **only one** instance (use Redis distributed lock or a dedicated worker service)
- Stateless app tier → scale out freely behind ALB
- Add MongoDB indexes already defined in models for query performance at scale

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `MONGO_URI` with auth
- [ ] Set `REDIS_PASSWORD`
- [ ] Configure SMTP for email alerts
- [ ] Set `CORS_ORIGIN` to your frontend URL
- [ ] Enable PM2 or systemd for process management
- [ ] Set up log rotation (Winston maxFiles already configured)
- [ ] Monitor with Prometheus + Grafana (export `/metrics` endpoint)
