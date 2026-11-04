try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null
    
    $asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    } | Select-Object -First 1

    $reqOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgrTask = [System.WindowsRuntimeSystemExtensions]::AsTask($reqOp)
    $mgrTask.Wait(1000) | Out-Null
    $manager = $mgrTask.Result

    $session = $manager.GetCurrentSession()
    if ($session) {
        $propOp = $session.TryGetMediaPropertiesAsync()
        $propTask = [System.WindowsRuntimeSystemExtensions]::AsTask($propOp)
        $propTask.Wait(1000) | Out-Null
        $props = $propTask.Result

        $playback = $session.GetPlaybackInfo()
        $status = $playback.PlaybackStatus.ToString()
        $timeline = $session.GetTimelineProperties()
        
        $pos = 0
        $dur = 0
        try {
            $pos = [Math]::Round($timeline.Position.TotalSeconds)
            $dur = [Math]::Round($timeline.EndTime.TotalSeconds)
        } catch {}

        @{
            hasMedia = $true
            title = if ($props.Title) { $props.Title } else { "Reproduciendo" }
            artist = if ($props.Artist) { $props.Artist } else { $props.AlbumTitle }
            status = $status
            isPlaying = ($status -eq "Playing")
            position = $pos
            duration = $dur
        } | ConvertTo-Json -Compress
    } else {
        @{
            hasMedia = $false
            isPlaying = $false
        } | ConvertTo-Json -Compress
    }
} catch {
    @{
        hasMedia = $false
        isPlaying = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
}
