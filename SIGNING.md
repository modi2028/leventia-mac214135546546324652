# Code signing — fixing the SmartScreen / Smart App Control block

## Why it happens (and the honest truth)

Windows **SmartScreen** warns on, and **Smart App Control (SAC)** *fully blocks*, apps
that aren't signed by a certificate Windows trusts. Your machine has **SAC ON**, which
is the strict one — it blocks unknown/unsigned `.exe`s outright (no "Run anyway").

**There is no code or installer change that bypasses this.** Blocking unsigned apps is
the entire purpose of the feature. The build being NSIS/oneClick/obfuscated/etc. makes
no difference. The only real fixes are below.

---

## Option A — Proper fix for DISTRIBUTING to others (recommended)

Sign every build with a certificate Windows trusts. Cheapest options:

| Option | Cost | SmartScreen | SAC |
|---|---|---|---|
| **Azure Trusted Signing** | ~$10/month | ✅ trusted | ✅ trusted (recommended) |
| OV code-signing cert | ~$150–250/yr | ⚠️ builds reputation over days/weeks | ⚠️ usually OK once reputable |
| EV code-signing cert | ~$300+/yr | ✅ instant reputation | ✅ |

Once you have a cert (a `.pfx` + password, or an Azure Trusted Signing account), builds
sign automatically — electron-builder reads these env vars:

```powershell
$env:CSC_LINK = "C:\path\to\cert.pfx"      # or a base64 of the pfx
$env:CSC_KEY_PASSWORD = "your-pfx-password"
npm run dist:obf
```

(For Azure Trusted Signing, follow Microsoft's electron-builder guide — it uses a
`signtoolOptions`/dlib config instead of a pfx.) After this, no SmartScreen/SAC block
for anyone.

---

## Option B — Unblock YOUR OWN machine right now (no purchase)

Run **as Administrator**, after building:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\trust-cert.ps1
```

It creates a self-signed cert, **trusts it on this PC**, and signs the Setup + app exe.
Click **YES** on the one Windows prompt. This only affects *this* machine — it does
nothing for your customers' PCs (that needs Option A).

If SAC still blocks it afterward (its model can refuse unknown apps even when validly
signed), the last resort on your own PC is to turn SAC off:
**Windows Security → App & browser control → Smart App Control → Off**
(note: re-enabling SAC later requires a Windows reset — it's a one-way switch).

---

## Quick end-user workaround (per download)

If you just sent someone the unsigned Setup and they only get **SmartScreen** (not SAC):
**More info → Run anyway**. If they have **SAC**, that won't appear — they need Option A.
