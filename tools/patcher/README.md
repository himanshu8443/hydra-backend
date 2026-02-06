# Hydra Backend URL Patcher

Patch Hydra Launcher to use your own backend URLs without rebuilding from source.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd tools/patcher
npm install
```

### 2. Patch Hydra

**Windows (installed version):**
```bash
node patch-hydra.js "C:\Program Files\Hydra" --api-url http://localhost:3001
```

**Windows (portable version):**
```bash
node patch-hydra.js "C:\path\to\Hydra-portable" --api-url http://localhost:3001
```

**macOS:**
```bash
node patch-hydra.js "/Applications/Hydra.app/Contents" --api-url http://localhost:3001
```

**Linux (AppImage - must be extracted first):**
```bash
# Extract AppImage first
./Hydra-x.x.x.AppImage --appimage-extract
node patch-hydra.js "./squashfs-root" --api-url http://localhost:3001
```

### 3. Restore Original
```bash
node patch-hydra.js "C:\Program Files\Hydra" --restore
```

## 📋 Options

| Option | Description | Default |
|--------|-------------|---------|
| `--api-url <url>` | Main API server URL | `http://localhost:3001` |
| `--auth-url <url>` | Authentication server URL | `http://localhost:3001/auth` |
| `--ws-url <url>` | WebSocket server URL | `ws://localhost:3001/ws` |
| `--nimbus-url <url>` | Nimbus API URL | `http://localhost:3001` |
| `--checkout-url <url>` | Checkout/payment URL | `http://localhost:3001/checkout` |
| `--restore` | Restore from backup | - |
| `--dry-run` | Preview changes without applying | - |

## 📝 Examples

### Patch with all custom URLs
```bash
node patch-hydra.js "C:\Program Files\Hydra" \
  --api-url https://api.myserver.com \
  --auth-url https://auth.myserver.com \
  --ws-url wss://ws.myserver.com
```

### Preview changes (dry run)
```bash
node patch-hydra.js "C:\Program Files\Hydra" --dry-run
```

### Patch and use HTTPS backend
```bash
node patch-hydra.js "C:\Program Files\Hydra" \
  --api-url https://hydra-api.mydomain.com \
  --ws-url wss://hydra-ws.mydomain.com/ws
```

## 🔧 How It Works

1. **Locates** the `app.asar` file in the Hydra installation
2. **Creates a backup** (`app.asar.backup`)
3. **Extracts** the asar archive
4. **Searches** all JavaScript files for known Hydra API URLs
5. **Replaces** them with your custom URLs
6. **Repacks** the asar archive

## ⚠️ Important Notes

- **Close Hydra** before patching
- **Backup is automatic** - the original `app.asar` is saved as `app.asar.backup`
- **Updates will overwrite** - you'll need to repatch after Hydra updates
- **Run as Administrator** on Windows if patching in Program Files

## 🔄 Automation (Repatch After Updates)

Create a batch script to automatically repatch after updates:

**Windows (`repatch.bat`):**
```batch
@echo off
echo Waiting for Hydra to close...
timeout /t 5

echo Patching Hydra...
cd /d "%~dp0"
node patch-hydra.js "C:\Program Files\Hydra" ^
  --api-url http://localhost:3001 ^
  --auth-url http://localhost:3001/auth ^
  --ws-url ws://localhost:3001/ws

echo Done!
pause
```

**Linux/macOS (`repatch.sh`):**
```bash
#!/bin/bash
sleep 5
node patch-hydra.js "/Applications/Hydra.app/Contents" \
  --api-url http://localhost:3001 \
  --auth-url http://localhost:3001/auth \
  --ws-url ws://localhost:3001/ws
```

## 🐛 Troubleshooting

### "Could not find app.asar"
- Make sure you're pointing to the Hydra installation directory, not the executable
- On Windows: `C:\Program Files\Hydra` not `C:\Program Files\Hydra\Hydra.exe`

### "Permission denied"
- Run as Administrator (Windows) or with sudo (Linux/macOS)
- Or copy Hydra to a user-writable location

### "No matching URLs found"
- The patcher might not recognize the URL patterns in your Hydra version
- Try running with `--dry-run` to see what's detected
- You may need to update the `KNOWN_PATTERNS` in the script

## 📄 License

MIT License - Use at your own risk.
