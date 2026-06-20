using TagLib;

public class MusicLibrary
{
    private List<Track> _tracks;
    private string _musicFolderPath;

    /// <summary>
    /// Создаёт экземпляр класса <see cref="MusicLibrary"/>.
    /// </summary>
    public MusicLibrary()
    {
        _musicFolderPath = $"{AppDomain.CurrentDomain.BaseDirectory}/Music";

        _tracks = new List<Track>();

        ScanFolder();
    }

    /// <summary>
    /// Получение данных из файлов из папки.
    /// </summary>
    private void ScanFolder()
    {
        _tracks.Clear();

        if (!Directory.Exists(_musicFolderPath))
        {
            Directory.CreateDirectory(_musicFolderPath);
        }

        string[] files = Directory.GetFiles(_musicFolderPath, "*.mp3");

        foreach (string file in files)
        {
            var tagFile = TagLib.File.Create(file);
            string tagTitle = tagFile.Tag.Title;
            string tagArtist = tagFile.Tag.FirstPerformer;
            string tagAlbum = tagFile.Tag.Album;

            string title;
            string artist;
            string album;
            string coverPath = null;

            if (!string.IsNullOrEmpty(tagTitle))
            {
                title = tagTitle;
            }
            else
            {
                title = Path.GetFileNameWithoutExtension(file);
            }

            if (!string.IsNullOrEmpty(tagArtist))
            {
                artist = tagArtist;
            }
            else
            {
                artist = "Неизвестный исполнитель";
            }

            if (!string.IsNullOrEmpty(tagAlbum))
            {
                album = tagAlbum;
            }
            else
            {
                album = string.Empty;
            }

            // Извлечение обложки
            if (tagFile.Tag.Pictures.Length > 0)
            {
                var picture = tagFile.Tag.Pictures[0];

                // Создаybt папки Covers, если её нет
                string coversFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Covers");
                if (!Directory.Exists(coversFolder))
                    Directory.CreateDirectory(coversFolder);

                // Уникальное имя файла на основе названия трека
                string safeFileName = string.Join("_", title.Split(Path.GetInvalidFileNameChars()));
                string extension = picture.MimeType switch
                {
                    "image/jpeg" => ".jpg",
                    "image/png" => ".png",
                    _ => ".jpg"
                };

                string absolutePath = Path.Combine(coversFolder, safeFileName + extension);

                if (!System.IO.File.Exists(absolutePath))
                {
                    System.IO.File.WriteAllBytes(absolutePath, picture.Data.Data);
                }

                coverPath = "Covers/" + safeFileName + extension;
            }

            _tracks.Add(new Track(file, coverPath, title, artist, album, tagFile.Properties.Duration));

            tagFile.Dispose();
        }
    }

    /// <summary>
    /// Обновление данных при добавлении файлов во время работы программы.
    /// </summary>
    public void Refresh()
    {
        ScanFolder();
    }

    /// <summary>
    /// Сканирование папки на файлы.
    /// </summary>
    /// <returns>Список найденных файлов.</returns>
    public IReadOnlyList<Track> GetAllTracks()
    {
        return _tracks;
    }
}