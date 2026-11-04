using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Media.Control;

namespace LockNotchMedia;

class Program
{
    private static GlobalSystemMediaTransportControlsSessionManager? _manager;
    private static GlobalSystemMediaTransportControlsSession? _currentSession;
    private static readonly object _lock = new();

    private static string _lastTitle = "";
    private static string _lastArtist = "";
    private static bool _lastPlaying = false;
    private static int _lastPos = -1;
    private static string _assetsDir = "";

    static async Task Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        if (args.Length > 0 && Directory.Exists(args[0]))
        {
            _assetsDir = args[0];
        }

        try
        {
            _manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            _manager.CurrentSessionChanged += async (s, e) => await UpdateSessionAsync();
            _manager.SessionsChanged += async (s, e) => await UpdateSessionAsync();

            await UpdateSessionAsync();

            // Escuchar comandos desde stdin de Electron (toggle, next, prev)
            _ = Task.Run(async () =>
            {
                while (true)
                {
                    var line = await Console.In.ReadLineAsync();
                    if (line == null) break;
                    line = line.Trim().ToLowerInvariant();

                    var session = _currentSession;
                    if (session != null)
                    {
                        try
                        {
                            switch (line)
                            {
                                case "play":
                                    await session.TryPlayAsync();
                                    break;
                                case "pause":
                                    await session.TryPauseAsync();
                                    break;
                                case "toggle":
                                    await session.TryTogglePlayPauseAsync();
                                    break;
                                case "next":
                                    await session.TrySkipNextAsync();
                                    break;
                                case "prev":
                                    await session.TrySkipPreviousAsync();
                                    break;
                            }
                        }
                        catch { }
                    }
                }
            });

            // Polling de sincronización periódica
            while (true)
            {
                await Task.Delay(1000);
                await PublishStateAsync(periodic: true);
            }
        }
        catch (Exception ex)
        {
            EmitJson(new { type = "media", hasMedia = false, isPlaying = false, error = ex.Message });
        }
    }

    private static async Task UpdateSessionAsync()
    {
        if (_manager == null) return;

        var session = _manager.GetCurrentSession();
        if (session != _currentSession)
        {
            _currentSession = session;
            if (_currentSession != null)
            {
                _currentSession.MediaPropertiesChanged += async (s, e) => await PublishStateAsync(false);
                _currentSession.PlaybackInfoChanged += async (s, e) => await PublishStateAsync(false);
                _currentSession.TimelinePropertiesChanged += async (s, e) => await PublishStateAsync(false);
            }
        }

        await PublishStateAsync(false);
    }

    private static async Task PublishStateAsync(bool periodic)
    {
        var session = _currentSession;
        if (session == null)
        {
            if (_lastPlaying || !string.IsNullOrEmpty(_lastTitle))
            {
                _lastTitle = "";
                _lastArtist = "";
                _lastPlaying = false;
                EmitJson(new { type = "media", hasMedia = false, isPlaying = false });
            }
            return;
        }

        try
        {
            var props = await session.TryGetMediaPropertiesAsync();
            var playback = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();

            bool isPlaying = playback?.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
            string title = props?.Title ?? "";
            string artist = props?.Artist ?? "";
            string album = props?.AlbumTitle ?? "";

            if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(artist))
            {
                if (_lastPlaying || !string.IsNullOrEmpty(_lastTitle))
                {
                    _lastTitle = "";
                    _lastArtist = "";
                    _lastPlaying = false;
                    EmitJson(new { type = "media", hasMedia = false, isPlaying = false });
                }
                return;
            }

            int pos = timeline != null ? (int)timeline.Position.TotalSeconds : 0;
            int dur = timeline != null ? (int)timeline.EndTime.TotalSeconds : 0;
            string finalArtist = !string.IsNullOrEmpty(artist) ? artist : album;

            // Extraer carátula si cambió la canción
            bool trackChanged = title != _lastTitle || finalArtist != _lastArtist;
            string? thumbUrl = null;

            if (trackChanged && props?.Thumbnail != null && !string.IsNullOrEmpty(_assetsDir))
            {
                try
                {
                    using var stream = await props.Thumbnail.OpenReadAsync();
                    using var netStream = stream.AsStreamForRead();
                    using var ms = new MemoryStream();
                    await netStream.CopyToAsync(ms);
                    if (ms.Length > 0)
                    {
                        var thumbPath = Path.Combine(_assetsDir, "current_media.jpg");
                        await File.WriteAllBytesAsync(thumbPath, ms.ToArray());
                        thumbUrl = "assets/current_media.jpg?" + DateTime.UtcNow.Ticks;
                    }
                }
                catch { }
            }

            // Si es periódico y nada cambió más que 1 segundo, no saturar si no está reproduciendo
            if (periodic && !isPlaying && title == _lastTitle && finalArtist == _lastArtist && isPlaying == _lastPlaying)
            {
                return;
            }

            _lastTitle = title;
            _lastArtist = finalArtist;
            _lastPlaying = isPlaying;
            _lastPos = pos;

            string sourceAppId = session.SourceAppUserModelId ?? "";

            EmitJson(new
            {
                type = "media",
                hasMedia = true,
                isPlaying = isPlaying,
                title = title,
                artist = finalArtist,
                position = pos,
                duration = dur,
                thumbnail = thumbUrl,
                appId = sourceAppId
            });
        }
        catch
        {
            EmitJson(new { type = "media", hasMedia = false, isPlaying = false });
        }
    }

    private static void EmitJson(object obj)
    {
        lock (_lock)
        {
            string json = JsonSerializer.Serialize(obj);
            Console.WriteLine(json);
        }
    }
}
