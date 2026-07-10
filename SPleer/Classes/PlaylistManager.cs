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
            if (string.IsNullOrWhiteSpace(json))
            {
                _playlists = new List<Playlist>();
                return;
            }

            try
            {
                _playlists = System.Text.Json.JsonSerializer.Deserialize<List<Playlist>>(json) ?? new List<Playlist>();
            }
            catch
            {
                _playlists = new List<Playlist>();
            }
        }
        else
        {
            _playlists = new List<Playlist>();
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
            playlist.TrackPaths.Insert(0, filePath);
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
    /// Возвращает плейлист по ID.
    /// </summary>
    /// <param name="id">ID плейлиста.</param>
    /// <returns>Объект плейлиста или null.</returns>
    public Playlist? GetPlaylistById(int id) => _playlists.FirstOrDefault(p => p.Id == id);

    /// <summary>
    /// Проверка, содержится ли трек в плейлисте по указанному пути.
    /// </summary>
    /// <param name="playlistId">ID плейлиста.</param>
    /// <param name="trackPath">Путь к файлу трека.</param>
    /// <returns>true, если трек в плейлисте.</returns>
    public bool IsTrackInPlaylist(int playlistId, string trackPath)
    {
        var playlist = GetPlaylistById(playlistId);
        return playlist?.TrackPaths.Contains(trackPath) ?? false;
    }

    /// <summary>
    /// Возвращает путь к обложке первого трека в плейлисте.
    /// </summary>
    /// <param name="playlistId">ID плейлиста.</param>
    /// <returns>Путь к обложке или null.</returns>
    public string? GetFirstTrackCoverPath(int playlistId)
    {
        var playlist = GetPlaylistById(playlistId);
        if (playlist?.TrackPaths == null || playlist.TrackPaths.Count == 0) return null;

        var firstTrackPath = playlist.TrackPaths[0];
        // Ищем трек в MusicLibrary по пути
        var track = _musicLibrary.GetAllTracks().FirstOrDefault(t => t.FilePath == firstTrackPath);
        return track?.CoverPath;
    }

    /// <summary>
    /// Сохранение нового названия плейлиста.
    /// </summary>
    /// <param name="id">ID плейлиста.</param>
    /// <param name="newName">Новое название плейлиста.</param>
    public void RenamePlaylist(int id, string newName)
    {
        var playlist = _playlists.FirstOrDefault(p => p.Id == id);

        if (playlist != null)
        {
            playlist.Name = newName;
            Save();
        }
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="id"></param>
    /// <param name="sourcePath"></param>
    public void SetPlaylistCover(int id, string sourcePath)
    {
        var playlist = _playlists.FirstOrDefault(p => p.Id == id);
        if (playlist == null) return;

        try
        {
            string coversFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Covers");
            if (!Directory.Exists(coversFolder))
                Directory.CreateDirectory(coversFolder);

            string fileName = "playlist_" + id + Path.GetExtension(sourcePath);
            string destPath = Path.Combine(coversFolder, fileName);
            System.IO.File.Copy(sourcePath, destPath, true);

            playlist.CoverPath = "Covers/" + fileName;
            Save();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Ошибка SetPlaylistCover: {ex.Message}");
        }
    }
}