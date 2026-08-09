# 🎲 Ludo Master - Multiplayer Ludo with Power Cards

A production-ready, responsive, mobile-first Ludo game built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Framer Motion**, **Prisma ORM**, **PostgreSQL**, and **Docker**.

---

## 🌟 Key Features

- **Pure TypeScript Game Engine**: Deterministic state machine supporting 52 main track cells, 4 home paths, safe star cells, captures, extra turns, and win detection.
- **5 Magical Power Cards**:
  1. ⚡ **Extra Move**: +2 steps boost.
  2. 🛡️ **Shield**: 2-turn capture protection.
  3. 🔄 **Swap**: Exchange places with enemy tokens.
  4. 🎲 **Lucky Roll**: Pick any dice outcome (1 to 6).
  5. 💥 **Attack**: Push enemy token back 3 steps.
- **Visual Design System**: Custom 15x15 board grid with rich color palettes (`#101828` Deep Navy, `#6C4BF4` Royal Purple, `#3B82F6` Electric Blue, `#FF6B6B` Coral, `#FFC857` Gold, `#38D39F` Mint).
- **Web Audio API Engine**: Real-time sound effects for dice rolls, token moves, captures, power cards, and victory fanfare.
- **AI Bot Integration**: Play offline vs AI Bots or local Pass & Play on the same device.
- **PostgreSQL & Prisma ORM**: Persists users, game rooms, player slots, match statistics, and move logs.
- **Docker Containerized**: Multi-stage build with Docker Compose for VPS deployment.

---

## 🚀 Running Locally with Docker

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd Luddo
   ```

2. **Start Next.js & PostgreSQL with Docker Compose**:
   ```bash
   docker-compose up --build -d
   ```

3. **Run Prisma Migrations / Database Push**:
   ```bash
   docker-compose exec web npx prisma db push
   ```

4. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Admin Panel & Password Reset

- **Admin area**: sign in at [http://localhost:3000/admin](http://localhost:3000/admin) (linked from the header shield icon).
- **Default admin account** (created by the seeder):
  - Username: `admin`
  - Password: `Admin@1234`
- Create or refresh it anytime:
  ```bash
  npm run db:seed        # creates/updates the admin account
  ```
  The admin username must be listed in the `ADMIN_USERNAMES` env var (comma-separated, default `admin`).
- The admin can manage the voice-phrase library (Hindi/English) and upload custom game sound effects (SFX) from `/admin`.

**Password recovery (SMTP email)**
- Sign-up now collects an optional email used for "Forgot password?" on the login screen.
- Configure SMTP in `.env`:
  ```env
  SMTP_HOST="smtp.gmail.com"
  SMTP_PORT=587
  SMTP_USER="vixalyze.contact@gmail.com"
  SMTP_PASS="fvgo hxna skzg ugcr"   # Gmail App Password
  SMTP_FROM="Ludo Master <vixalyze.contact@gmail.com>"
  NEXT_PUBLIC_APP_URL="http://localhost:3000"  # base URL used in the reset link
  ```
- A reset link is emailed to the account address; it opens `/reset-password?token=…` where a new password can be set. Tokens expire after 30 minutes.

---

## 🌐 Production VPS Hosting Instructions (Ubuntu / Debian)

Follow these steps to deploy **Ludo Master** on any VPS hosting provider (DigitalOcean, AWS EC2, Linode, Hetzner, Vultr):

### Step 1: Install Docker & Docker Compose on VPS
Connect to your VPS via SSH and install Docker:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Step 2: Clone Code & Start Containers
```bash
git clone <your-repo-url> /var/www/luddo
cd /var/www/luddo

# Copy environment variables
cp .env.example .env

# Start containers in background
docker-compose up --build -d

# Push database schema to PostgreSQL
docker-compose exec web npx prisma db push
```

### Step 3: Configure Nginx Reverse Proxy
Create an Nginx configuration for your domain or VPS IP:
```bash
sudo nano /etc/nginx/sites-available/ludo
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com; # Or server_name _; for IP address

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the Nginx site and test config:
```bash
sudo ln -s /etc/nginx/sites-available/ludo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 4: Enable Free SSL Certificate (HTTPS)
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Your Ludo game is now live and secure with HTTPS on your VPS! 🎉

---

## 🛠️ Tech Stack Overview

- **Frontend**: Next.js 14 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide Icons, Canvas Confetti.
- **Engine**: Pure TypeScript deterministic Ludo rule engine.
- **Database**: PostgreSQL 16, Prisma ORM.
- **DevOps**: Docker, Docker Compose, Nginx, Let's Encrypt SSL.
