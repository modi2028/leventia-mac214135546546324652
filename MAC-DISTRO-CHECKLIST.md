# Mac Distribution Checklist

## Files to Give Test Users

### For Apple Silicon Macs (M1/M2/M3):

- [ ] `Leventia-Alting-x.x.x-arm64.dmg` (built on Mac)
- [ ] `MAC-SETUP-GUIDE.md`

### For Intel Macs:

- [ ] `Leventia-Alting-x.x.x-x64.dmg` (built on Mac)
- [ ] `MAC-SETUP-GUIDE.md`

---

## Before Distributing

### Build Checklist (run on Mac):

```bash
# 1. Install dependencies
npm install

# 2. Generate Mac icon
npm run make-icon

# 3. Build for Mac
npm run dist

# 4. Test the built app
open "release/Leventia Alting.app"

# 5. Test multi-instance
open -n /Applications/Roblox.app
# (Should open multiple instances)
```

### Files to Include in Distribution:

From `release/` folder:
- `Leventia Alting.app` (inside DMG)
- `Leventia-Alting-x.x.x-arm64.dmg`
- `Leventia-Alting-x.x.x-arm64.zip` (optional)

---

## Testing Instructions for Test Users

1. **Install Roblox** from roblox.com first
2. **Install Leventia Alting** from DMG
3. **Add account** via cookie
4. **Test join** with a private server code
5. **Test multi-instance**: Launch 2+ accounts

---

## Known Issues to Communicate

Tell test users these features **don't work yet** on Mac:

- Anti-AFK automation
- Mute Roblox
- Auto-Rejoin
- Low GPU mode (may not work)

---

## Support Links

- Setup Guide: `MAC-SETUP-GUIDE.md`
- Issue Tracker: (your GitHub/issues link)
