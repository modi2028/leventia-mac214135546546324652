# Leventia Alting - macOS Setup Guide

## For Test Users

This guide helps you set up and run Leventia Alting on macOS.

---

## System Requirements

- **macOS 11 (Big Sur) or later**
- **Intel or Apple Silicon (M1/M2/M3) Mac**
- **Roblox for Mac installed** from [roblox.com](https://www.roblox.com/download)
- **Node.js 18+** (only if building from source)

---

## Quick Start (Pre-built)

### Option 1: Download DMG (Recommended)

1. **Download** `Leventia-Alting-x.x.x-arm64.dmg` (or x64 for Intel Macs)
2. **Open the DMG** and drag `Leventia Alting.app` to Applications
3. **Launch** from Applications or Spotlight
4. **First run**: Right-click → Open (bypasses Gatekeeper)

### Option 2: Download ZIP

1. **Download** `Leventia-Alting-x.x.x-mac.zip`
2. **Unzip** and move `Leventia Alting.app` to Applications
3. **Launch** from Applications

---

## Building from Source (Developers)

### Step 1: Install Dependencies

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 18+
brew install node@18

# Verify installation
node --version  # Should be v18+
npm --version
```

### Step 2: Clone & Build

```bash
# Navigate to project directory
cd ~/path/to/roblox-account-dashboard

# Install dependencies
npm install

# Generate Mac icon (.icns)
npm run make-icon

# Build for Mac
npm run dist

# Output: release/Leventia Alting.app + .dmg
```

---

## What's Different on Mac vs Windows?

| Feature | Windows | Mac |
|---------|---------|-----|
| **Multi-instance** | Requires mutex handling | Built-in (`open -n`) |
| **Roblox Location** | Registry scan | `/Applications/Roblox.app` |
| **Process Kill** | `taskkill` | `pkill` |
| **Cookie Path** | `%LOCALAPPDATA%\Roblox` | `~/Library/Application Support/Roblox` |

---

## Known Limitations (Mac Version)

These features are **not yet available** on macOS:

- ❌ **Anti-AFK Automation** (window detection not implemented)
- ❌ **Mute Roblox** (WASAPI is Windows-only)
- ❌ **Auto-Rejoin** (window detection not implemented)
- ❌ **Low GPU Mode** (if Mac Roblox uses different settings path)

**Core features that work:**
- ✅ Multi-account launching
- ✅ Cookie management
- ✅ Server joining via private server codes
- ✅ Account switching
- ✅ License validation (if enabled)

---

## Troubleshooting

### "Roblox.app not found"

**Solution**: Install Roblox from [roblox.com](https://www.roblox.com/download)

```bash
# Verify Roblox is installed
ls -la /Applications/Roblox.app
# OR
ls -la ~/Applications/Roblox.app
```

### "Cannot verify developer"

**Solution**: Right-click the app → Open → Open anyway

Or disable Gatekeeper (not recommended):

```bash
sudo spctl --master-disable
```

### Build fails with "iconutil not found"

**Solution**: The build script tries to use macOS `iconutil`. If it fails:

```bash
# Manually create .icns using iconutil
cd public
mkdir icon.iconset
# ... (script will generate iconset)
iconutil -c icns icon.iconset -o icon.icns
```

### Multiple Roblox instances don't launch

**Solution**: Verify `open -n` works:

```bash
# Test multi-instance manually
open -n /Applications/Roblox.app
open -n /Applications/Roblox.app  # Should open second instance
```

---

## Testing Checklist

For test users, please verify:

- [ ] App launches without crash
- [ ] Can add Roblox accounts via cookie
- [ ] Can join a private server
- [ ] Can launch 2+ accounts simultaneously
- [ ] "Leave" button disconnects accounts
- [ ] Accounts don't log out each other
- [ ] App survives window close (Cmd+W doesn't quit)

---

## Files to Distribute to Test Users

### Required Files:

1. **`Leventia-Alting-x.x.x-arm64.dmg`** (Apple Silicon) OR
   **`Leventia-Alting-x.x.x-x64.dmg`** (Intel)

2. **This setup guide** (MAC-SETUP-GUIDE.md)

### Optional (for debugging):

- **Console logs**: `~/Library/Logs/Leventia Alting/`
- **App data**: `~/Library/Application Support/Leventia Alting/`

---

## Developer Notes

### Architecture

```
electron/
├── platform/
│   ├── win32/index.ts    # Windows launcher (mutex, taskkill, etc.)
│   ├── darwin/index.ts   # Mac launcher (open -n, pkill)
│   └── index.ts          # Platform selector
├── ipc/roblox.ts         # Uses platform abstraction
├── multi-instance.ts     # Skips mutex on Mac
└── hwid.ts               # Platform-specific hardware ID
```

### Building Both Platforms

```bash
# Windows (on Windows machine)
npm run dist

# Mac (on Mac machine)
npm run dist
```

**Separate builds** - not a universal binary!

---

## Support

If you encounter issues not covered here:

1. **Check console logs**: `~/Library/Logs/Leventia Alting/`
2. **Verify Roblox location**: `/Applications/Roblox.app`
3. **Test `open -n`**: Should open multiple Roblox instances

---

## Version Info

- **Leventia Alting**: v2.3.0
- **Electron**: v33.4.11
- **macOS Support**: Added in v2.4.0 (in development)
