public class Track
{
    private static int _nextId = 1;

    public int Id { get; }
    public string FilePath { get; }
    public string CoverPath { get; }
    public string Title { get; }
    public string Artist { get; }
    public string Album { get; }
    public TimeSpan Duration { get; }

    // Свойство для получения пути файла, не хранявшееся в памяти
    public string FileName => Path.GetFileName(FilePath);
    public string DurationFormatted => Duration.ToString(@"mm\:ss");


    /// <summary>
    /// Создаёт экземпляр класса <see cref="Track"/>.
    /// </summary>
    /// <param name="filePath">Путь файла.</param>
    /// <param name="title">Название песни.</param>
    /// <param name="artist">Автор(ы) песни.</param>
    /// <param name="duration">Продолжительность песни.</param>
    public Track(string filePath, string coverPath, string title, string artist, string album, TimeSpan duration)
    {
        Id = _nextId++;
        FilePath = filePath;
        CoverPath = coverPath;
        Title = title;
        Artist = artist;
        Album = album;
        Duration = duration;
    }
}