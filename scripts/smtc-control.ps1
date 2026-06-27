param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('toggle', 'next', 'previous', 'seek')]
    [string]$Action,
    [long]$PositionMs = 0,
    [long]$DurationMs = 0
)

$ErrorActionPreference = 'Stop'

function Send-MediaKey {
    param([byte]$VirtualKey)
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMediaKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public static void Press(byte vk) {
        keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
    [NativeMediaKeys]::Press($VirtualKey)
}

function Wait-AsyncOperation {
    param($AsyncOperation, [Type]$ResultType)
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
        } |
        Select-Object -First 1
    if (-not $method) { throw 'WinRT AsTask helper not found' }
    $asTask = $method.MakeGenericMethod($ResultType)
    $task = $asTask.Invoke($null, @($AsyncOperation))
    $task.Wait()
    return $task.Result
}

function Get-SmtcManager {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime]

    try {
        return [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::GetForCurrentUser()
    } catch {
        $request = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
        return Wait-AsyncOperation $request ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    }
}

function Get-QQMusicSession {
    $manager = Get-SmtcManager
    foreach ($session in $manager.GetSessions()) {
        $id = $session.SourceAppUserModelId.ToLower()
        if ($id -match 'qqmusic|qq音乐|tencent') {
            return $session
        }
    }
    return $null
}

function Get-SessionPositionMs {
    param($Session)
    if (-not $Session) { return 0 }
    try {
        return [long]$Session.GetTimelineProperties().Position.TotalMilliseconds
    } catch {
        return 0
    }
}

function Get-SessionDurationMs {
    param($Session)
    if (-not $Session) { return 0 }
    try {
        return [long]$Session.GetTimelineProperties().EndTime.TotalMilliseconds
    } catch {
        return 0
    }
}

function Test-SeekReached {
    param([long]$TargetMs, [long]$ActualMs, [long]$ToleranceMs = 5000)

    if ($TargetMs -le 0) { return ($ActualMs -le $ToleranceMs) }
    return [Math]::Abs($ActualMs - $TargetMs) -le $ToleranceMs
}

function Get-QQMusicProcess {
    return Get-Process -Name QQMusic -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Ensure-QQSeekNative {
    if ([type]::GetType('QQSeekNative') -ne $null) { return }

    Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class QQSeekNative {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    public struct RECT { public int Left, Top, Right, Bottom; }
    public const uint WM_LBUTTONDOWN = 0x0201;
    public const uint WM_LBUTTONUP = 0x0202;
    public static IntPtr FindTrackWindow(uint pid) {
        IntPtr best = IntPtr.Zero;
        long bestScore = 0;
        EnumWindows((h,l)=> {
            uint wp; GetWindowThreadProcessId(h, out wp);
            if (wp != pid) return true;
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, 512);
            string title = sb.ToString();
            if (title.Length == 0) return true;
            if (title.Contains("Dummy") || title.Contains("TXMenu") || title.Contains("IME")
                || title.Contains("MolePlugin") || title.Contains("Weiyun") || title.Contains("HintWnd")
                || title.Contains("DynamicLyric") || title.Contains("GDI+") || title.Contains("Sogou")
                || title.Contains("Default IME") || title.Contains("MSCTFIME") || title.Contains("COM_WND")) {
                return true;
            }
            bool looksLikeTrack = title.Contains(" - ") || title.Contains("(");
            if (!looksLikeTrack) return true;
            RECT r; GetClientRect(h, out r);
            int w = r.Right - r.Left;
            int hgt = r.Bottom - r.Top;
            if (w < 480 || hgt < 320) return true;
            long score = (long)w * hgt + 2000000000L;
            if (score > bestScore) { bestScore = score; best = h; }
            return true;
        }, IntPtr.Zero);
        return best;
    }
    public static bool ClickProgress(IntPtr hwnd, double ratio) {
        RECT r; GetClientRect(hwnd, out r);
        int w = r.Right - r.Left;
        int h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) return false;
        int leftPad = (int)Math.Round(w * 0.14);
        int rightPad = (int)Math.Round(w * 0.08);
        int trackW = Math.Max(1, w - leftPad - rightPad);
        int x = leftPad + (int)Math.Round(trackW * Math.Max(0.0, Math.Min(1.0, ratio)));
        int y = h - (int)Math.Round(h * 0.075);
        IntPtr lp = (IntPtr)((y << 16) | (x & 0xFFFF));
        SendMessage(hwnd, WM_LBUTTONDOWN, (IntPtr)1, lp);
        SendMessage(hwnd, WM_LBUTTONUP, IntPtr.Zero, lp);
        return true;
    }
}
"@
}

function Get-QQMusicTrackWindow {
    param([int]$ProcessId)
    Ensure-QQSeekNative
    return [QQSeekNative]::FindTrackWindow([uint32]$ProcessId)
}

function Seek-QQMusicInBackground {
    param([long]$TargetMs, [long]$TotalMs)

    if ($TotalMs -le 0) { return $false }

    $proc = Get-QQMusicProcess
    if (-not $proc) { return $false }

    $hwnd = Get-QQMusicTrackWindow -ProcessId $proc.Id
    if ($hwnd -eq [IntPtr]::Zero) { return $false }

    $ratio = [Math]::Max(0.0, [Math]::Min(1.0, $TargetMs / [double]$TotalMs))
    Ensure-QQSeekNative
    [QQSeekNative]::ClickProgress($hwnd, $ratio) | Out-Null
    return $true
}

function Invoke-QQMusicSeek {
    param([long]$TargetMs, [long]$TotalMs)

    $session = Get-QQMusicSession
    if ($TotalMs -le 0) {
        $TotalMs = Get-SessionDurationMs $session
    }

    if ($session) {
        try {
            $ticks = [TimeSpan]::FromMilliseconds($TargetMs).Ticks
            $op = $session.TryChangePlaybackPositionAsync($ticks)
            $ok = Wait-AsyncOperation $op ([bool])
            if ($ok) {
                Start-Sleep -Milliseconds 500
                $afterMs = Get-SessionPositionMs $session
                if (Test-SeekReached -TargetMs $TargetMs -ActualMs $afterMs) {
                    return $true
                }
            }
        } catch {
            # fall through
        }
    }

    if ($TotalMs -le 0) { return $false }

    if (-not (Seek-QQMusicInBackground -TargetMs $TargetMs -TotalMs $TotalMs)) {
        return $false
    }

    Start-Sleep -Milliseconds 600
    $session2 = Get-QQMusicSession
    $finalMs = Get-SessionPositionMs $session2
    return (Test-SeekReached -TargetMs $TargetMs -ActualMs $finalMs -ToleranceMs 8000)
}

switch ($Action) {
    'toggle' {
        Send-MediaKey 0xB3
        exit 0
    }
    'next' {
        Send-MediaKey 0xB0
        exit 0
    }
    'previous' {
        Send-MediaKey 0xB1
        exit 0
    }
    'seek' {
        Invoke-QQMusicSeek -TargetMs $PositionMs -TotalMs $DurationMs | Out-Null
        exit 0
    }
}
