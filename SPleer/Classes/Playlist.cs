public class Playlist
{
    private static int _nextId = 1;

    public int Id { get; }
    public string Name { get; set; }
    public string CoverPath { get; set; }
    public List<string> TrackPaths { get; set; }


    /// <summary>
    /// Создаёт экземпляр класса <see cref="Playlist"/>.
    /// </summary>
    /// <param name="name">Название плейлиста.</param>
    /// <param name="coverPath">Путь к изображению плейлиста.</param>
    public Playlist(string name,  string coverPath)
    {
        Id = _nextId++;
        Name = string.IsNullOrEmpty(name) ? "New Playlist" : name;
        CoverPath = string.IsNullOrEmpty(coverPath) ? null : coverPath;
        TrackPaths = new List<string>();
    }
}