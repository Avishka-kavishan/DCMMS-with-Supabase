# Government Branch Local Server Deployment Guide

This guide details step-by-step instructions for deploying the **Discipline Management System (DCMMS)** web application on a local server computer in an air-gapped or intranet government environment using **PostgreSQL**, **Next.js 16 (React 19)**, **Prisma ORM**, **PM2**, and **IIS / Nginx**.

---

## 1. System Architecture

```
                   ┌────────────────────────────────────────┐
                   │        Government Branch LAN           │
                   │                                        │
┌──────────────┐   │  ┌──────────────────────────────────┐  │
│  Client PC   ├───┼──► Reverse Proxy (Nginx / IIS)      │  │
│ (Browser)    │   │  └────────────────┬─────────────────┘  │
└──────────────┘   │                   │ Port 3000          │
                   │  ┌────────────────▼─────────────────┐  │
                   │  │ Next.js Web Application         │  │
                   │  │ (Process Managed by PM2)         │  │
                   │  │ (Prisma Client + Server Actions) │  │
                   │  └────────────────┬─────────────────┘  │
                   │                   │ Port 5432          │
                   │  ┌────────────────▼─────────────────┐  │
                   │  │ PostgreSQL 16+ Database          │  │
                   │  └──────────────────────────────────┘  │
                   │                                        │
                   │          LOCAL SERVER COMPUTER         │
                   └────────────────────────────────────────┘
```

---

## 2. Prerequisites & Server Requirements

- **Operating System**: Windows Server 2019/2022 or Ubuntu 22.04 LTS
- **Node.js**: v20.x LTS or higher
- **Database**: PostgreSQL v16.x or higher
- **RAM**: Minimum 8 GB (16 GB recommended)
- **Disk Space**: 50 GB SSD storage minimum

---

## 3. Step-by-Step Setup Instructions

### Step 1: Install & Configure PostgreSQL
1. Download and install **PostgreSQL 16** on the local server.
2. Open `pgAdmin` or `psql` shell as `postgres` superuser:
   ```sql
   CREATE DATABASE dmms_db;
   CREATE USER db_user WITH PASSWORD 'StrongGovernmentPass2026!';
   GRANT ALL PRIVILEGES ON DATABASE dmms_db TO db_user;
   ```
3. Allow localhost/intranet connections in `pg_hba.conf` if necessary:
   ```text
   host    dmms_db         db_user         127.0.0.1/32            scram-sha-256
   ```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local` or `.env.production` in the project root:
```env
DATABASE_URL="postgresql://db_user:StrongGovernmentPass2026!@localhost:5432/dmms_db?schema=public"
PORT=3000
NODE_ENV="production"
```

---

### Step 3: Run Database Schema Migrations
Initialize the 18 unified system tables in your PostgreSQL database using Prisma:
```powershell
# Generate Prisma Client
npx prisma generate

# Push database schema to local PostgreSQL
npx prisma db push
```

---

### Step 4: Build & Launch Next.js Application with PM2

1. Build the production package:
   ```powershell
   npm run build
   ```

2. Install PM2 process manager globally:
   ```powershell
   npm install -g pm2
   ```

3. Start application using `ecosystem.config.js`:
   ```powershell
   pm2 start ecosystem.config.js
   pm2 save
   ```

4. Enable auto-restart on server reboot:
   - **For Windows Server**:
     ```powershell
     npm install -g pm2-windows-startup
     pm2-startup install
     ```
   - **For Ubuntu Linux**:
     ```bash
     pm2 startup
     ```

---

### Step 5: Configure Reverse Proxy (IIS or Nginx)

#### Option A: Windows Server with IIS (Recommended for Windows)
1. Install **URL Rewrite** module and **ARR (Application Request Routing)** in IIS.
2. Create a new site in IIS (e.g., `DCMMS Intranet`) bound to Port 80 / 443.
3. Add Reverse Proxy rule in `web.config` forwarding requests to `http://localhost:3000`.

#### Option B: Linux Server with Nginx
Create `/etc/nginx/sites-available/dcmms`:
```nginx
server {
    listen 80;
    server_name dcmms.local 192.168.x.x;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/dcmms /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

---

## 4. Automated Backup Strategy

Automated backups are configured using `scripts/backup_postgres.ps1`.

### Set up Windows Task Scheduler:
1. Open **Task Scheduler** on Windows Server.
2. Create a daily task scheduled at **02:00 AM**.
3. Action: Start a program -> `powershell.exe`.
4. Arguments: `-ExecutionPolicy Bypass -File "C:\inetpub\DCMMS-with-Supabase\scripts\backup_postgres.ps1"`.

Backups are saved to `C:\Backups\PostgreSQL` with automatic 30-day retention cleanup.
