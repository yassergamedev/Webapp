# SSL Certificate Setup Guide

## 📁 Files Needed

Place these files in the `/home/arcade/Webapp/ssl/` folder:

1. `jukebox.8bitbar.com.au.crt` - Certificate file
2. `jukebox.8bitbar.com.au.key` - Private key file (you need to convert from .p7b if needed)
3. `jukebox.8bitbar.com.au.ca-bundle` - Certificate authority bundle

## 🔑 Getting the Private Key

**Important:** The `.p7b` file does NOT contain the private key - it only contains the certificate chain. The private key is generated when you create the CSR (Certificate Signing Request) and must be kept secure.

### Options to get your private key:

### Option 1: Check if you still have the key from CSR generation
If you generated the CSR yourself, the private key should be in the same location where you created the CSR:
```bash
# Look for .key files
ls -la ssl/*.key
```

### Option 2: Extract certificate from P7B (for your crt file)
```bash
openssl pkcs7 -print_certs -in jukebox.8bitbar.com.au.p7b -out jukebox.8bitbar.com.au.crt
```
This only gives you the certificate, NOT the private key.

### Option 3: Use your existing server.key
If you have a working server.key file from before:
```bash
cp ssl/server.key ssl/jukebox.8bitbar.com.au.key
```

### Option 2: Extract private key from existing files
If you have the key from your previous setup:
```bash
# The private key should be in: ssl/jukebox.8bitbar.com.au.key
```

## 📋 Current Configuration

The server is configured to use:
- **Key:** `/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.key`
- **Certificate:** `/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.crt`
- **CA Bundle:** `/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.ca-bundle`

## 🔧 If You Need to Change Paths

Edit these lines in `api-server.js`:
```javascript
process.env.SSL_KEY_PATH = '/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.key';
process.env.SSL_CERT_PATH = '/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.crt';
process.env.SSL_CA_PATH = '/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.ca-bundle';
```

## ✅ Verification

After placing the files, restart the server and check for:
```
🔒 SSL certificates found, starting HTTPS server...
🚀 HTTPS Server running on https://localhost:443
🌐 Public access: https://jukebox.8bitbar.com.au
```

## ⚠️ File Permissions

Make sure the SSL files have correct permissions:
```bash
chmod 600 /home/arcade/Webapp/ssl/*.key
chmod 644 /home/arcade/Webapp/ssl/*.crt
chmod 644 /home/arcade/Webapp/ssl/*.ca-bundle
```

## 🔍 Troubleshooting

### Certificate Not Found
- Check that files are in: `/home/arcade/Webapp/ssl/`
- Verify file names match exactly

### Permission Denied
- Run: `chmod 600 ssl/*.key`
- Make sure the webapp user can read SSL files

### Bad Certificate
- Verify certificate hasn't expired
- Check certificate chain is complete
