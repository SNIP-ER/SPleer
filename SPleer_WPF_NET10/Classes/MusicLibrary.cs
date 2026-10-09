using System.IO;
using System.Collections.Concurrent;
using System.Diagnostics;

public class MusicLibrary
{
    private volatile IReadOnlyList<Track> _tracks = Array.Empty<Track>();
    private readonly object _scanLock = new();
    private readonly ConcurrentQueue<(string Old, string New)> _pendingRenames = new();
    private int _scanVersion;
    private volatile bool _isScanning;
    private string? _watchedFolder;
    private string _musicFolderPath;
    private FileSystemWatcher? _watcher;
    private static readonly string[] SupportedExtensions =
        { ".mp3", ".wav", ".m4a", ".wma", ".ogg", ".flac", ".aiff", ".aif", ".opus" };

    public bool IsScanning => _isScanning;

    /// <summary>
    /// Событие, вызываемое при изменении состава файлов в папке с музыкой.
    /// </summary>
    public event Action? LibraryChanged;

    /// <summary>
    /// Событие, вызываемое при переименовании файла в папке с музыкой.
    /// Параметры: старый путь, новый путь.
    /// </summary>
    public event Action<string, string>? TrackRenamed;

    /// <summary>
    /// Создаёт экземпляр класса <see cref="MusicLibrary"/>.
    /// </summary>
    /// <param name="customFolderPath">Пользовательский путь к папке с музыкой,
    /// или null для пути по умолчанию.</param>
    public MusicLibrary(string? customFolderPath = null)
    {
        _musicFolderPath = Path.GetFullPath(customFolderPath
            ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Music"));
    }

    /// <summary>
    /// Сканирует папку в фоне. По завершении вызывает LibraryChanged.
    /// Если во время скана стартовал новый, результат старого отбрасывается.
    /// </summary>
    public Task StartScanAsync()
    {
        int version;
        string folder;
        lock (_scanLock)
        {
            version = ++_scanVersion;
            _isScanning = true;
            folder = _musicFolderPath;
        }

        return Task.Run(() =>
        {
            List<Track>? result = null;
            try
            {
                result = ScanFolder(folder, version);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка сканирования: {ex.Message}");
            }

            lock (_scanLock)
            {
                // уже идёт более новый скан
                if (version != _scanVersion) return;

                if (result != null)
                {
                    _tracks = result;
                    StartWatching(folder);
                }
                _isScanning = false;
            }

            while (_pendingRenames.TryDequeue(out var rename))
            {
                TrackRenamed?.Invoke(rename.Old, rename.New);
            }

            LibraryChanged?.Invoke();
        });
    }

    /// <summary>
    /// Меняет папку с музыкой на новую, пересканирует её и перезапускает отслеживание изменений.
    /// </summary>
    /// <param name="newPath">Новый путь к папке с музыкой.</param>
    public void SetMusicFolder(string newPath)
    {
        lock (_scanLock)
        {
            _watcher?.Dispose();
            _watcher = null;
            _watchedFolder = null;
            _musicFolderPath = Path.GetFullPath(newPath);
        }
        // не блокирует вызывающий поток
        _ = StartScanAsync();
    }

    /// <summary>
    /// Запускает отслеживание изменений в папке с музыкой
    /// (добавление/удаление/переименование mp3-файлов).
    /// </summary>
    /// <param name="folder">Папка с музыкой.</param>
    private void StartWatching(string folder)
    {
        if (_watcher != null && _watchedFolder == folder) return;

        _watcher?.Dispose();
        _watchedFolder = folder;
        _watcher = new FileSystemWatcher(folder)
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
    private void OnFolderChanged(object sender, FileSystemEventArgs e)
    {
        Thread.Sleep(300);
        _ = StartScanAsync();
    }

    /// <summary>
    /// Ответ на уведомление об переименовании трека в папке.
    /// </summary>
    private void OnFileRenamed(object sender, RenamedEventArgs e)
    {
        Thread.Sleep(300);
        _pendingRenames.Enqueue((e.OldFullPath, e.FullPath));
        _ = StartScanAsync();
    }

    /// <summary>
    /// Читает теги и обложки файлов из папки и формирует список треков.
    /// </summary>
    /// <param name="folder">Папка с музыкой.</param>
    /// <param name="version">
    /// Номер версии скана, присвоенный при запуске. Если во время работы счётчик
    /// <c>_scanVersion</c> изменился (то есть стартовал более новый скан), метод прекращает работу.
    /// </param>
    private List<Track>? ScanFolder(string folder, int version)
    {
        var result = new List<Track>();

        if (!Directory.Exists(folder))
        {
            Directory.CreateDirectory(folder);
        }

        string[] files = Directory.GetFiles(folder, ".")
            .Where(f => SupportedExtensions.Contains(Path.GetExtension(f), StringComparer.OrdinalIgnoreCase))
            .ToArray();

        foreach (string file in files)
        {
            // Запущен более новый скан, выходим раньше
            if (version != Volatile.Read(ref _scanVersion)) return null;

            try
            {
                using var tagFile = TagLib.File.Create(file);
                string tagTitle = tagFile.Tag.Title;
                string tagArtist = tagFile.Tag.FirstPerformer;
                string tagAlbum = tagFile.Tag.Album;
                string? lyrics = string.IsNullOrWhiteSpace(tagFile.Tag.Lyrics) ? null : tagFile.Tag.Lyrics;

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

                    if (!File.Exists(absolutePath))
                    {
                        File.WriteAllBytes(absolutePath, picture.Data.Data);
                    }

                    coverPath = "Covers/" + safeFileName + extension;
                }

                result.Add(new Track(file, coverPath, title, artist, album,
                    tagFile.Properties.Duration, lyrics));
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Пропущен файл {file}: {ex.Message}");
            }
        }

        return result;
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