param([switch]$Dump)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($action, $name) {
    $o = @{ type = 'usb'; action = $action; name = $name } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($o)
    [Console]::Out.Flush()
}

# Volumenes extraibles / externos (barato: sin WMI)
function Get-Drives {
    $h = @{}
    foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
        if (($d.DriveType -eq 'Removable' -or $d.DriveType -eq 'Fixed') -and $d.IsReady) {
            $id = $d.Name.TrimEnd('\')
            $label = $d.VolumeLabel
            if ([string]::IsNullOrWhiteSpace($label)) { $label = 'Unidad' }
            $h[$id] = "$label ($id)"
        }
    }
    return $h
}

# Perifericos USB presentes (caro: solo se ejecuta ante un evento de hardware)
function Get-UsbDevices {
    $h = @{}
    $items = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'USB\VID_*' -and $_.InstanceId -notlike '*&MI_*' }
    foreach ($i in $items) {
        $n = $i.FriendlyName
        if ([string]::IsNullOrWhiteSpace($n)) { $n = $i.Name }
        if ([string]::IsNullOrWhiteSpace($n)) { $n = 'Dispositivo USB' }
        $h[$i.InstanceId] = $n
    }
    return $h
}

if ($Dump) {
    (Get-Drives).GetEnumerator() | ForEach-Object { "DRIVE  $($_.Key) = $($_.Value)" }
    (Get-UsbDevices).GetEnumerator() | ForEach-Object { "USB    $($_.Key) = $($_.Value)" }
    exit
}

$knownDrives = Get-Drives
$knownUsb = Get-UsbDevices

Register-CimIndicationEvent -ClassName Win32_DeviceChangeEvent -SourceIdentifier 'LN_DevChange' | Out-Null

while ($true) {
    $evt = Wait-Event -SourceIdentifier 'LN_DevChange' -Timeout 3
    $hardwareEvent = $false
    if ($evt) {
        $hardwareEvent = $true
        Start-Sleep -Milliseconds 700            # debounce: un USB dispara varios eventos
        Get-Event | Remove-Event
    }

    $emittedDrive = $false
    $curDrives = Get-Drives
    foreach ($k in $curDrives.Keys) {
        if (-not $knownDrives.ContainsKey($k)) { Emit 'connected' $curDrives[$k]; $emittedDrive = $true }
    }
    foreach ($k in @($knownDrives.Keys)) {
        if (-not $curDrives.ContainsKey($k)) { Emit 'disconnected' $knownDrives[$k]; $emittedDrive = $true }
    }
    $knownDrives = $curDrives

    if ($hardwareEvent) {
        $curUsb = Get-UsbDevices
        if (-not $emittedDrive) {
            foreach ($k in $curUsb.Keys) {
                if (-not $knownUsb.ContainsKey($k)) { Emit 'connected' $curUsb[$k] }
            }
            foreach ($k in @($knownUsb.Keys)) {
                if (-not $curUsb.ContainsKey($k)) { Emit 'disconnected' $knownUsb[$k] }
            }
        }
        $knownUsb = $curUsb
    }
}
