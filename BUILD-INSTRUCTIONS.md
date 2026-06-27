# 🛡️ Secure Build Instructions

## ⚠️ IMPORTANT: Never Give Source Code to Test Users

**Test users should ONLY receive:**
- ✅ Compiled `.dmg` file (Mac)
- ✅ Compiled `.exe` file (Windows)
- ❌ NEVER the source code

---

## 🔒 Option 1: GitHub Actions (RECOMMENDED - Most Secure)

### Why GitHub Actions?
- ✅ Builds in the cloud (no Mac needed)
- ✅ Source code stays on GitHub (private)
- ✅ Test users only get compiled `.dmg`
- ✅ Free for public repos, cheap for private
- ✅ Automatic builds on every commit

### Setup Steps:

1. **Push to GitHub** (private repo):
```bash
git add .
git commit -m "Add macOS support"
git push
```

2. **Enable GitHub Actions**:
- Go to: `https://github.com/YOUR-USERNAME/YOUR-REPO/actions`
- Click "I understand my workflows, go ahead and enable them"

3. **Trigger build**:
- Either push code (automatic)
- Or go to Actions tab → click "Run workflow"

4. **Download artifacts**:
- Go to Actions tab → Click on workflow run
- Scroll to "Artifacts" section
- Download `Leventia-Alting-mac` (contains `.dmg`)

5. **Give to test users**:
- Only the `.dmg` file from artifacts
- Delete artifacts after 7 days (auto-cleanup)

---

## 🔒 Option 2: Trusted Mac (Less Secure)

If you MUST use a physical Mac:

### Steps:
1. **Use a clean Mac** (wipe afterward)
2. **Copy project temporarily**
3. **Build** → get `.dmg`
4. **DELETE source code** from Mac
5. **Only keep the `.dmg` file**

### After Build:
```bash
# On Mac, after building:
cd ~/path/to/project
# Copy .dmg somewhere safe
cp release/*.dmg ~/Desktop/
# DELETE project source
cd ~
rm -rf ~/path/to/project
```

---

## 🔒 Option 3: Obfuscated Build (For Windows)

Your existing obfuscation for Windows:
```bash
npm run dist:obf
```

For Mac, the Electron app is already compiled/compiled JS, but you can add extra protection in package.json:

```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false
}
```

---

## 🎯 What to Actually Give Test Users

### Mac Users:
```
✅ Leventia-Alting-2.3.0-arm64.dmg (from GitHub Actions artifacts)
✅ MAC-SETUP-GUIDE.md (instructions)
❌ Source code (NEVER)
```

### Windows Users:
```
✅ Setup Leventia Alting Program V2.3.exe (from release/)
✅ Instructions
❌ Source code (NEVER)
```

---

## 🚀 Quick Start with GitHub Actions

### First Time Setup:

```bash
# 1. Create private GitHub repo
gh repo create leventia-alting --private --source=.

# 2. Push code
git push

# 3. Go to GitHub Actions tab
# URL: https://github.com/YOUR-USERNAME/leventia-alting/actions

# 4. Click "Enable Actions"

# 5. Wait for build to complete (~5-10 min)

# 6. Download artifacts (the .dmg file)
```

### Every Time You Need a Build:

```bash
# Just push!
git add .
git commit -m "Update"
git push

# Download new .dmg from Actions artifacts
```

---

## 🔐 Security Checklist

- [ ] Repo is set to **private**
- [ ] Never share repo URL with test users
- [ ] Only share `.dmg` files
- [ ] Delete old artifacts regularly
- [ ] Use `.gitignore` to exclude secrets
- [ ] Never commit API keys/license keys

---

## 📦 What Your Test Users See

They download:
```
Leventia-Alting-2.3.0-arm64.dmg
```

They install:
```
/Applications/Leventia Alting.app
```

They **DO NOT** see:
- Your source code ❌
- Your backend logic ❌
- Your API keys ❌
- Your GitHub repo ❌

---

This is the standard way to distribute desktop apps while protecting source code!
