# HTTPS Setup Guide for Jukebox Server

## Overview

This guide explains how to set up HTTPS for your jukebox server running on `jukebox.8bitbar.com.au`.

## Option 1: Self-Signed Certificate (Testing)

### Quick Setup:
```cmd
generate-ssl-cert.bat
start-jukebox-https.bat
```

### What This Does:
- Creates a self-signed SSL certificate
- Server runs on HTTPS (port 443) and HTTP (port 80)
- HTTP automatically redirects to HTTPS
- Browsers will show security warnings (click "Advanced" → "Proceed")

## Option 2: Real SSL Certificate (Production)

### Using Let's Encrypt (Free):

1. **Install Certbot:**
   ```bash
   # On Windows (using Chocolatey)
   choco install certbot
   
   # Or download from: https://certbot.eff.org/
   ```

2. **Generate Certificate:**
   ```bash
   certbot certonly --standalone -d jukebox.8bitbar.com.au
   ```

3. **Copy Certificates:**
   ```bash
   # Certificates are usually in:
   # C:\Certbot\live\jukebox.8bitbar.com.au\
   
   copy "C:\Certbot\live\jukebox.8bitbar.com.au\privkey.pem" "ssl\private.key"
   copy "C:\Certbot\live\jukebox.8bitbar.com.au\fullchain.pem" "ssl\certificate.crt"
   ```

4. **Start Server:**
   ```cmd
   start-jukebox-https.bat
   ```

### Using Your Domain Provider:

1. **Generate CSR (Certificate Signing Request):**
   ```bash
   openssl req -new -newkey rsa:2048 -nodes -keyout ssl\private.key -out ssl\jukebox.csr
   ```

2. **Submit CSR to your domain provider** (GoDaddy, Namecheap, etc.)

3. **Download the certificate** and save as `ssl\certificate.crt`

4. **Start Server:**
   ```cmd
   start-jukebox-https.bat
   ```

## Option 3: Environment Variables

Set these environment variables instead of using the ssl folder:

```cmd
set SSL_KEY_PATH=C:\path\to\your\private.key
set SSL_CERT_PATH=C:\path\to\your\certificate.crt
set HTTP_PORT=80
set HTTPS_PORT=443
```

## Port Configuration

### Router Setup:
- **Port 80** → `192.168.50.5:80` (HTTP redirect)
- **Port 443** → `192.168.50.5:443` (HTTPS)

### Firewall:
- Allow **incoming** connections on ports 80 and 443
- Allow **outgoing** connections to MongoDB (port 27017)

## Testing Your Setup

### 1. Check HTTP Redirect:
```bash
curl -I http://jukebox.8bitbar.com.au
# Should return: 301 Moved Permanently
# Location: https://jukebox.8bitbar.com.au/
```

### 2. Check HTTPS:
```bash
curl -I https://jukebox.8bitbar.com.au
# Should return: 200 OK
```

### 3. Test API:
- **Health Check:** `https://jukebox.8bitbar.com.au/api/health`
- **Albums:** `https://jukebox.8bitbar.com.au/api/albums`
- **Tracklist:** `https://jukebox.8bitbar.com.au/api/tracklist`

## Troubleshooting

### "Certificate not trusted" Error:
- **Self-signed:** Click "Advanced" → "Proceed to site"
- **Real certificate:** Check certificate chain and domain name

### "Port 443 already in use":
```cmd
netstat -ano | findstr :443
# Find the process and stop it
```

### "Permission denied" on port 443:
- Run Command Prompt as Administrator
- Or use a different port (e.g., 8443)

### Certificate not found:
- Check file paths in `ssl` folder
- Verify environment variables
- Check file permissions

## Security Notes

### Self-Signed Certificates:
- ⚠️ **Not secure** for production
- Browsers will show warnings
- Use only for testing

### Real Certificates:
- ✅ **Secure** for production
- No browser warnings
- Automatically trusted

### Best Practices:
- Use strong private keys (2048+ bits)
- Keep private keys secure
- Renew certificates before expiry
- Use HSTS headers (optional)

## File Structure

```
jukebox-server/
├── ssl/
│   ├── private.key      # Private key
│   └── certificate.crt  # Certificate
├── api-server.js        # Main server
├── start-jukebox-https.bat
├── generate-ssl-cert.bat
└── HTTPS_SETUP.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HTTP_PORT` | HTTP port | 80 |
| `HTTPS_PORT` | HTTPS port | 443 |
| `SSL_KEY_PATH` | Path to private key | `ssl/private.key` |
| `SSL_CERT_PATH` | Path to certificate | `ssl/certificate.crt` |
| `MONGODB_URI` | MongoDB connection string | (required) |

## Next Steps

1. **Choose your certificate method** (self-signed for testing, real for production)
2. **Generate/obtain certificates**
3. **Run the HTTPS startup script**
4. **Test your setup**
5. **Update your domain DNS** if needed
6. **Configure router port forwarding** for both HTTP and HTTPS


