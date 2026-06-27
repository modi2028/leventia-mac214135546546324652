import { spawn } from 'node:child_process'

// ─────────────────────────────────────────────────────────────────────────────
// Mute every Roblox instance's audio via the Windows Core Audio API (WASAPI).
// Per-process session mute is the only reliable way to silence individual Roblox
// windows (there's no stable in-game "mute all" FastFlag). Best-effort: any error
// is swallowed so it can never break Anti-AFK.
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT = (mute: boolean) => `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] public class MMDeviceEnumerator { }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator { int f0(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice dev); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice { int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioSessionManager2 { int f0(); int f1(); int GetSessionEnumerator(out IAudioSessionEnumerator e); }
[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioSessionEnumerator { int GetCount(out int c); int GetSession(int i, out IAudioSessionControl2 s); }
[Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioSessionControl2 {
  int g0(); int g1(); int g2(string n, ref Guid c); int g3(); int g4(string n, ref Guid c);
  int g5(out Guid g); int g6(ref Guid o, ref Guid c); int g7(IntPtr n); int g8(IntPtr n);
  int GetSessionIdentifier(out IntPtr p); int GetSessionInstanceIdentifier(out IntPtr p);
  int GetProcessId(out uint pid); int IsSystemSoundsSession(); int SetDuckingPreference(bool b);
}
[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ISimpleAudioVolume { int SetMasterVolume(float l, ref Guid c); int GetMasterVolume(out float l); int SetMute(bool m, ref Guid c); int GetMute(out bool m); }
public static class Muter {
  public static int Run(uint[] pids, bool mute) {
    int n = 0; Guid IID = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"); Guid ev = Guid.Empty;
    var en = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
    IMMDevice dev; if (en.GetDefaultAudioEndpoint(0, 1, out dev) != 0) return 0;
    object o; dev.Activate(ref IID, 1, IntPtr.Zero, out o);
    var mgr = (IAudioSessionManager2)o; IAudioSessionEnumerator se; mgr.GetSessionEnumerator(out se);
    int c; se.GetCount(out c);
    for (int i = 0; i < c; i++) {
      IAudioSessionControl2 s; if (se.GetSession(i, out s) != 0) continue;
      uint pid; s.GetProcessId(out pid);
      bool hit = false; foreach (var p in pids) if (p == pid) { hit = true; break; }
      if (!hit) continue;
      var v = (ISimpleAudioVolume)s; v.SetMute(mute, ref ev); n++;
    }
    return n;
  }
}
"@
$ids = @(Get-Process RobloxPlayerBeta -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($ids.Count -gt 0) { [Muter]::Run([uint32[]]$ids, ${mute ? '$true' : '$false'}) | Out-Null }
`

let muting = false
let pending: boolean | null = null   // latest desired state requested while busy

export function setMuteRoblox(mute: boolean): void {
  // Don't DROP a request that arrives mid-run — remember the latest desired state
  // and apply it once the current PowerShell finishes. Otherwise toggling mute OFF
  // right after it muted would be silently ignored (the audio stays muted forever).
  if (muting) { pending = mute; return }
  muting = true
  const finish = () => {
    muting = false
    if (pending !== null) { const next = pending; pending = null; if (next !== mute) setMuteRoblox(next) }
  }
  try {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT(mute)], { windowsHide: true })
    ps.on('close', finish)
    ps.on('error', finish)
  } catch { finish() }
}
