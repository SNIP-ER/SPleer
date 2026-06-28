public class PlaylistManager
{
    private List<Playlist> _playlists;
    private string _filePath;

    /// <summary>
    /// Создание файла для хранения данных плейлистов.
    /// </summary>
    public PlaylistManager()
    {
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
}