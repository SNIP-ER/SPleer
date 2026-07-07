public class PlaylistManager
{
    private List<Playlist> _playlists;
    private readonly MusicLibrary _musicLibrary;
    private string _filePath;

    /// <summary>
    /// Создание файла для хранения данных плейлистов.
    /// </summary>
    public PlaylistManager(MusicLibrary musicLibrary)
    {
        _musicLibrary = musicLibrary;
        _filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Playlists.json");
        _playlists = new List<Playlist>();

        Load();
    }

    public IReadOnlyList<Playlist> GetAllPlaylists() => _playlists;

    /// <summary>
    /// Создание плейлиста.
    /// </summary>
    /// <param name="name">Название плейлиста.</param>
    public void CreatePlaylist(string name)
    {
        _playlists.Add(new Playlist(name, null));
        Save();
    }

    /// <summary>
    /// Загрузка плейлиста.
    /// </summary>
    private void Load()
    {
        if (File.Exists(_filePath))
        {
            var json = File.ReadAllText(_filePath);
            _playlists = System.Text.Json.JsonSerializer.Deserialize<List<Playlist>>(json) ?? new List<Playlist>();
        }
    }

    /// <summary>
    /// Сохранение плейлиста.
    /// </summary>
    private void Save()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(_playlists);
        File.WriteAllText(_filePath, json);
    }

    /// <summary>
    /// Удаление плейлиста.
    /// </summary>
    /// <param name="id">Номер плейлиста.</param>
    public void DeletePlaylist(int id)
    {
        _playlists.RemoveAll(p => p.Id == id);
        Save();
    }

    /// <summary>
    /// Добавление трека в плейлист.
    /// </summary>
    /// <param name="playlistId">Номер плейлиста.</param>
    /// <param name="filePath">Путь трека.</param>
    public void AddTrackToPlaylist(int playlistId, string filePath)
    {
        var playlist = _playlists.FirstOrDefault(p => p.Id == playlistId);

        if (playlist != null && !playlist.TrackPaths.Contains(filePath))
        {
            playlist.TrackPaths.Add(filePath);
            Save();
        }
    }

    /// <summary>
    /// Удаление трека из плейлиста.
    /// </summary>
    /// <param name="playlistId">Номер плейлиста.</param>
    /// <param name="filePath">Путь трека.</param>
    public void RemoveTrackFromPlaylist(int playlistId, string filePath)
    {
        var playlist = _playlists.FirstOrDefault(p => p.Id == playlistId);

        if (playlist != null && playlist.TrackPaths.Contains(filePath))
        {
            playlist.TrackPaths.Remove(filePath);
            Save();
        }
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="id"></param>
    /// <returns></returns>
    public Playlist? GetPlaylistById(int id) => _playlists.FirstOrDefault(p => p.Id == id);

    /// <summary>
    /// 
    /// </summary>
    /// <param name="playlistId"></param>
    /// <param name="trackPath"></param>
    /// <returns></returns>
    public bool IsTrackInPlaylist(int playlistId, string trackPath)
    {
        var playlist = GetPlaylistById(playlistId);
        return playlist?.TrackPaths.Contains(trackPath) ?? false;
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="playlistId"></param>
    /// <returns></returns>
    public string? GetFirstTrackCoverPath(int playlistId)
    {
        var playlist = GetPlaylistById(playlistId);
        if (playlist?.TrackPaths == null || playlist.TrackPaths.Count == 0) return null;

        var firstTrackPath = playlist.TrackPaths[0];
        // Ищем трек в MusicLibrary по пути
        var track = _musicLibrary.GetAllTracks().FirstOrDefault(t => t.FilePath == firstTrackPath);
        return track?.CoverPath;
    }
}