# 🔒 PrivyMessages

Minimal encrypted messaging app — Node.js + MongoDB + Socket.io.

Messages are encrypted with **AES-256-CBC** before storage. Admin can view all messages decrypted.

---

## Quick Start (Local)

### 1. Prerequisites
- Node.js 18+ → https://nodejs.org
- MongoDB running locally → https://www.mongodb.com/try/download/community

### 2. Install
```bash
cd privymessages
npm install
```

### 3. Configure
```bash
cp .env.example .env
```
Edit `.env`:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/privymessages
JWT_SECRET=pick_a_long_random_string_here
ENCRYPTION_KEY=exactly_32_chars_key_here_padded
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourSecurePassword
```

> ⚠️ **ENCRYPTION_KEY must be exactly 32 characters** — it's padded/trimmed automatically but set it properly.

### 4. Run
```bash
npm start
```
Open http://localhost:3000

---

## Admin Account

On first start the server auto-creates an admin user from your `.env` values.
- Login at http://localhost:3000 with admin credentials
- You'll be redirected to `/admin.html` automatically

---

## How It Works

| What | How |
|------|-----|
| Auth | JWT tokens (7 day expiry) stored in localStorage |
| Passwords | bcrypt hashed, never stored plain |
| Messages | AES-256-CBC encrypted before MongoDB storage |
| Real-time | Socket.io, token authenticated |
| Admin | Master view — all users + all messages decrypted |

---

## Deploy to a VPS (DigitalOcean / Linode / Hetzner)

### Step 1 — Get a server
- Create Ubuntu 22.04 droplet (cheapest $6/mo works fine)
- SSH in: `ssh root@YOUR_SERVER_IP`

### Step 2 — Install dependencies
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update && apt-get install -y mongodb-org
systemctl start mongod && systemctl enable mongod

# PM2 (keeps app running)
npm install -g pm2
```

### Step 3 — Upload your app
```bash
# From your local machine:
scp -r ./privymessages root@YOUR_SERVER_IP:/opt/privymessages
```
Or use git:
```bash
git clone your-repo /opt/privymessages
```

### Step 4 — Configure & start
```bash
cd /opt/privymessages
npm install
cp .env.example .env
nano .env   # fill in your values
pm2 start server.js --name privymessages
pm2 save
pm2 startup  # run the printed command to auto-start on reboot
```

### Step 5 — Nginx reverse proxy (optional but recommended for port 80/443)
```bash
apt-get install -y nginx
```

Create `/etc/nginx/sites-available/privymessages`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

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

```bash
ln -s /etc/nginx/sites-available/privymessages /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

### Step 6 — HTTPS with Let's Encrypt (free SSL)
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## Deploy to Railway (easiest — free tier available)

1. Push code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Add MongoDB plugin in Railway dashboard
4. Set environment variables in Railway Settings:
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `MONGODB_URI` (auto-provided by Railway MongoDB plugin)
5. Deploy — Railway gives you a public URL instantly

---

## Deploy to Render

1. Push to GitHub
2. https://render.com → New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add MongoDB via MongoDB Atlas (free M0 cluster):
   - https://cloud.mongodb.com → free cluster → get connection string
   - Set `MONGODB_URI` in Render environment variables
6. Set all other env vars and deploy

---

## File Structure

```
privymessages/
├── server.js           ← Express + Socket.io server
├── package.json
├── .env.example
├── models/
│   ├── User.js         ← User schema (username, password, isAdmin)
│   └── Message.js      ← Message schema (from, to, content encrypted, iv)
├── routes/
│   ├── auth.js         ← POST /api/auth/login, /register
│   ├── messages.js     ← GET/POST messages, GET users
│   └── admin.js        ← Admin: view/delete users & messages
├── middleware/
│   └── auth.js         ← JWT middleware
├── utils/
│   └── crypto.js       ← AES-256 encrypt/decrypt
└── public/
    ├── index.html      ← Login / Register
    ├── app.html        ← Messaging interface
    ├── admin.html      ← Admin panel
    ├── css/style.css
    └── js/
        ├── app.js
        └── admin.js
```
