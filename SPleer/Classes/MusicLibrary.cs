using TagLib;

public class MusicLibrary
{
    private List<Track> _tracks;
    private string _musicFolderPath;
    private FileSystemWatcher? _watcher;
    private static readonly string[] SupportedExtensions = { ".mp3", ".wav", ".m4a", ".wma", ".ogg" };

    /// <summary>
    /// Событие, вызываемое при изменении состава файлов в папке с музыкой.
    /// </summary>
    public event Action? LibraryChanged;

    /// <summary>
    /// Событие, вызываемое при переименовании файла в папке с музыкой. Параметры: старый путь, новый путь.
    /// </summary>
    public event Action<string, string>? TrackRenamed;

    /// <summary>
    /// Создаёт экземпляр класса <see cref="MusicLibrary"/>.
    /// </summary>
    /// <param name="customFolderPath">Пользовательский путь к папке с музыкой, или null для пути по умолчанию.</param>
    public MusicLibrary(string? customFolderPath = null)
    {
        _musicFolderPath = Path.GetFullPath(customFolderPath ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Music"));
        _tracks = new List<Track>();

        ScanFolder();
        StartWatching();
    }

    /// <summary>
    /// Меняет папку с музыкой на новую, пересканирует её и перезапускает отслеживание изменений.
    /// </summary>
    /// <param name="newPath">Новый путь к папке с музыкой.</param>
    public void SetMusicFolder(string newPath)
    {
        _watcher?.Dispose();
        _musicFolderPath = Path.GetFullPath(newPath);
        ScanFolder();
        StartWatching();
        LibraryChanged?.Invoke();
    }

    /// <summary>
    /// Запускает отслеживание изменений в папке с музыкой (добавление/удаление/переименование mp3-файлов).
    /// </summary>
    private void StartWatching()
    {
        _watcher = new FileSystemWatcher(_musicFolderPath)
        {
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite,
            EnableRaisingEvents = true
        };
        foreach (var ext in SupportedExtensions)
        {
            _watcher.Filters.Add($"*{ext}");
        }

        _watcher.Created += OnFolderChanged;
        _watcher.Deleted += OnFolderChanged;
        _watcher.Renamed += OnFileRenamed;
    }

    /// <summary>
    /// Ответ на уведомление об добавлении/удалении трека из папки.
    /// </summary>
    /// <param name="sender"></param>
    /// <param name="e"></param>
    private void OnFolderChanged(object sender, FileSystemEventArgs e)
    {
        // Небольшая задержка
        System.Threading.Thread.Sleep(300);

        ScanFolder();
        LibraryChanged?.Invoke();
    }

    /// <summary>
    /// Ответ на уведомление об переименовании трека в папке.
    /// </summary>
    /// <param name="sender"></param>
    /// <param name="e"></param>
    private void OnFileRenamed(object sender, RenamedEventArgs e)
    {
        System.Threading.Thread.Sleep(300);
        ScanFolder();
        TrackRenamed?.Invoke(e.OldFullPath, e.FullPath);
        LibraryChanged?.Invoke();
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

        string[] files = Directory.GetFiles(_musicFolderPath, ".")
            .Where(f => SupportedExtensions.Contains(Path.GetExtension(f), StringComparer.OrdinalIgnoreCase))
            .ToArray();

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