public class Playlist
{
    private static int _nextId = 1;

    public int Id { get; set; }
    public string Name { get; set; }
    public string CoverPath { get; set; }
    public List<string> TrackPaths { get; set; } = new List<string>();


    public Playlist() { }

    /// <summary>
    /// Создаёт экземпляр класса <see cref="Playlist"/>.
    /// </summary>
    /// <param name="name">Название плейлиста.</param>
    /// <param name="coverPath">Путь к изображению плейлиста.</param>
    public Playlist(string name,  string? coverPath)
    {
        Id = _nextId++;
        Name = string.IsNullOrEmpty(name) ? "New Playlist" : name;
        CoverPath = string.IsNullOrEmpty(coverPath) ? null : coverPath;
    }

    /// <summary>
    /// Гарантирует, что следующий сгенерированный Id не пересечётся с уже существующим.
    /// </summary>
    /// <param name="existingId">Id, который уже занят загруженным плейлистом.</param>
    public static void EnsureNextIdAtLeast(int existingId)
    {
        if (existingId >= _nextId)
        {
            _nextId = existingId + 1;
        }
    }
}