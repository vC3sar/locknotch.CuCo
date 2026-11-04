$winmd = @(
    "C:\Windows\System32\WinMetadata\Windows.Foundation.winmd",
    "C:\Windows\System32\WinMetadata\Windows.Media.winmd",
    "C:\Windows\System32\WinMetadata\Windows.Media.Control.winmd"
)

$src = @'
using System;
using System.Threading.Tasks;
using Windows.Media.Control;

public class MediaHelper {
    public static async Task<string> GetMediaJsonAsync() {
        try {
            var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            var session = manager.GetCurrentSession();
            if (session == null) {
                return "{\"hasMedia\":false,\"isPlaying\":false}";
            }
            var props = await session.TryGetMediaPropertiesAsync();
            var pb = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();
            bool isPlaying = pb != null && pb.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
            string title = props != null && !string.IsNullOrEmpty(props.Title) ? props.Title : "";
            string artist = props != null && !string.IsNullOrEmpty(props.Artist) ? props.Artist : "";
            int pos = timeline != null ? (int)timeline.Position.TotalSeconds : 0;
            int dur = timeline != null ? (int)timeline.EndTime.TotalSeconds : 0;
            
            title = title.Replace("\\", "\\\\").Replace("\"", "\\\"");
            artist = artist.Replace("\\", "\\\\").Replace("\"", "\\\"");

            return "{\"hasMedia\":true,\"isPlaying\":" + (isPlaying ? "true" : "false") + 
                   ",\"title\":\"" + title + "\",\"artist\":\"" + artist + 
                   "\",\"position\":" + pos + ",\"duration\":" + dur + "}";
        } catch {
            return "{\"hasMedia\":false,\"isPlaying\":false}";
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $src -ReferencedAssemblies $winmd -Language CSharp
} catch {}

[MediaHelper]::GetMediaJsonAsync().GetAwaiter().GetResult()
