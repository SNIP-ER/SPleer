using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;

namespace SPleer
{
    [ClassInterface(ClassInterfaceType.AutoDual)]
    [ComVisible(true)]
    public class MusicLibraryBridge
    {
        private readonly MusicLibrary _library;
        private readonly AudioPlayer _audioPlayer;
        private readonly PlaylistManager _playlistManager;
        private readonly SettingsManager _settingsManager;
        private readonly Window _window;

        /// <summary>
        /// Создаёт экземпляр класса <see cref="MusicLibraryBridge"/>.
        /// </summary>
        /// <param name="library">Библиотека треков.</param>
        /// <param name="window">Главное окно приложения (для управления окном из JS).</param>
        public MusicLibraryBridge(MusicLibrary library, Window window)
        {
            _library = library;
            _window = window;
            _playlistManager = new PlaylistManager(library);
            _settingsManager = new SettingsManager();
            _audioPlayer = new AudioPlayer();
            _audioPlayer.SetMusicLibrary(_library);

            _library.LibraryChanged += () =>
            {
                _window.Dispatcher.Invoke(() =>
                {
                    MainWindow.WebView?.CoreWebView2?.ExecuteScriptAsync("onLibraryChanged()");
                });
            };

            _library.TrackRenamed += (oldPath, newPath) =>
            {
                _playlistManager.RenameTrackPath(oldPath, newPath);
                _audioPlayer.RenameCurrentTrackPath(oldPath, newPath);

                _window.Dispatcher.Invoke(() =>
                {
                    MainWindow.WebView?.CoreWebView2?.ExecuteScriptAsync("onLibraryChanged()");
                });
            };
        }


        // --- УПРАВЛЕНИЕ ОКНОМ ---

        /// <summary>
        /// Перетаскивание окна.
        /// </summary>
        /// [DllImport("user32.dll")]
        [DllImport("user32.dll")]
        private static extern int SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        public void StartDrag()
        {
            var hwnd = new System.Windows.Interop.WindowInteropHelper(_window).Handle;
            ReleaseCapture();
            SendMessage(hwnd, 0xA1, (IntPtr)0x2, IntPtr.Zero);
        }

        /// <summary>
        /// Свернуть окно.
        /// </summary>
        public void MinimizeWindow()
        {
            _window.WindowState = WindowState.Minimized;
        }

        /// <summary>
        /// Развернуть/восстановить окно.
        /// </summary>
        public void MaximizeRestoreWindow()
        {
            if (_window.WindowState == WindowState.Minimized)
            {
                _window.WindowState = WindowState.Normal;
                return;
            }

            _window.WindowState = _window.WindowState == WindowState.Maximized
                ? WindowState.Normal
                : WindowState.Maximized;
        }

        /// <summary>
        /// Закрыть окно.
        /// </summary>
        public void CloseWindow()
        {
            _window.Close();
        }


        // --- БИБЛИОТЕКА ---

        /// <summary>
        /// Составление списка треков.
        /// </summary>
        /// <returns>Возвращает список треков в виде JSON-строки.</returns>
        public string GetTracksJson()
        {
            try
            {
                var tracks = _library.GetAllTracks();
                return System.Text.Json.JsonSerializer.Serialize(tracks);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Ошибка GetTracksJson: {ex.Message}");
                return "[]";
            }
        }


        // --- ВОСПРОИЗВЕДЕНИЕ ---

        /// <summary>
        /// Начать воспроизвдение трека.
        /// </summary>
        /// <param name="filePath">Путь к файлу.</param>
        public void PlayTrack(string filePath)
        {
            try { _audioPlayer.PlayWithNormalization(filePath); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка PlayTrack: {ex.Message}"); }
        }

        /// <summary>
        /// Останавить воспроизведение без сброса позиции.
        /// </summary>
        public void PauseTrack()
        {
            try { _audioPlayer.Pause(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка PauseTrack: {ex.Message}"); }
        }

        /// <summary>
        /// Продолжить воспроизведение с текущей позиции.
        /// </summary>
        public void ResumeTrack()
        {
            try { _audioPlayer.Resume(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка ResumeTrack: {ex.Message}"); }
        }

        /// <summary>
        /// Определение текущего состояния плеера.
        /// </summary>
        /// <returns>Состояние плеера (1 - играет, 0 - пауза/остановлен).</returns>
        public int GetPlayerState() => _audioPlayer.IsPlaying ? 1 : 0;

        /// <summary>
        /// Воспроизвести трек по индексу.
        /// </summary>
        /// <param name="index">Индекс трека, целое число.</param>
        public void PlayByIndex(int index)
        {
            try { _audioPlayer.PlayByIndex(index); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка PlayByIndex: {ex.Message}"); }
        }

        /// <summary>
        /// Следующий трек.
        /// </summary>
        public void PlayNext()
        {
            try { _audioPlayer.PlayNext(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка PlayNext: {ex.Message}"); }
        }

        /// <summary>
        /// Предыдущий трек.
        /// </summary>
        public void PlayPrevious()
        {
            try { _audioPlayer.PlayPrevious(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка PlayPrevious: {ex.Message}"); }
        }

        /// <summary>
        /// Запуск первого, если ничего не выбрано.
        /// </summary>
        public void PlayFirstIfNotPlaying()
        {
            try { _audioPlayer.PlayFirstIfNotPlaying(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка PlayFirstIfNotPlaying: {ex.Message}"); }
        }

        /// <summary>
        /// Включает или выключает нормализацию громкости.
        /// </summary>
        /// <param name="enabled">true — включить.</param>
        public void SetNormalizationEnabled(bool enabled) => _audioPlayer.SetNormalizationEnabled(enabled);

        /// <summary>
        /// Возвращает путь к файлу текущего воспроизводимого трека.
        /// </summary>
        /// <returns>Путь к файлу или null, если ничего не играет.</returns>
        public string? GetCurrentTrackPath() => _audioPlayer.GetCurrentTrackPath();

        /// <summary>
        /// Устанавливает индекс текущего трека в аудиоплеере.
        /// </summary>
        /// <param name="index">Индекс трека.</param>
        public void SetCurrentTrackIndex(int index) => _audioPlayer.SetCurrentTrackIndex(index);

        /// <summary>
        /// Задаёт активный порядок треков для навигации (сортировка, поиск или плейлист).
        /// </summary>
        /// <param name="json">JSON-строка с массивом путей к файлам треков.</param>
        public void SetActiveOrderJson(string? json)
        {
            var orderedPaths = string.IsNullOrEmpty(json)
                ? null
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
            _audioPlayer.SetActiveOrder(orderedPaths);
        }


        // --- ГРОМКОСТЬ ---

        /// <summary>
        /// Устанавить громкость.
        /// </summary>
        /// <param name="volume">Число от 0.0 до 1.0 .</param>
        public void SetVolume(float volume)
        {
            try { _audioPlayer.SetVolume(volume); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка SetVolume: {ex.Message}"); }
        }

        /// <summary>
        /// Узнать уровень громкости.
        /// </summary>
        /// <returns>Число от 0.0 до 1.0 .</returns>
        public float GetVolume() => _audioPlayer.Volume;


        // --- ПРОГРЕСС И ПЕРЕМОТКА ---

        /// <summary>
        /// Определить текущую позицию воспроизведения.
        /// </summary>
        /// <returns>Текущая позиция воспроизведения в секундах.</returns>
        public double GetCurrentPosition() => _audioPlayer.CurrentPosition;

        /// <summary>
        /// Узнать продолжительность трека для ползунка.
        /// </summary>
        /// <returns>Полная длительность трека в секундах.</returns>
        public double GetTotalDuration() => _audioPlayer.TotalDuration;

        /// <summary>
        /// Перемотка трека на указанную позицию.
        /// </summary>
        /// <param name="seconds">Секунда на которую нужно перемотать.</param>
        public void SeekTo(double seconds)
        {
            if (_audioPlayer.AudioFile != null)
            {
                _audioPlayer.AudioFile.CurrentTime = TimeSpan.FromSeconds(seconds);
            }
        }


        // --- РЕЖИМЫ ---

        /// <summary>
        /// Установить режим.
        /// </summary>
        /// <param name="mode">"sequential" или "shuffle".</param>
        public void SetMode(string mode)
        {
            try { _audioPlayer.SetMode(mode == "shuffle" ? PlaybackMode.Shuffle : PlaybackMode.Sequential); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка SetMode: {ex.Message}"); }
        }

        /// <summary>
        /// Получить текущий режим.
        /// </summary>
        /// <returns>Текущий режим, строка.</returns>
        public string GetMode() => _audioPlayer.GetMode().ToString().ToLower();

        /// <summary>
        /// Получение индекса текущего трека.
        /// </summary>
        /// <returns>Индекс - целое число.</returns>
        public int GetCurrentTrackIndex() => _audioPlayer.GetCurrentTrackIndex();

        /// <summary>
        /// Переключает режим повтора одного трека через аудиоплеер.
        /// </summary>
        public void ToggleRepeatOne()
        {
            try { _audioPlayer.ToggleRepeatOne(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка ToggleRepeatOne: {ex.Message}"); }
        }


        // --- ПЛЕЙЛИСТЫ ---

        /// <summary>
        /// Возвращает список плейлистов в формате JSON.
        /// </summary>
        public string GetPlaylistsJson()
        {
            var playlists = _playlistManager.GetAllPlaylistsWithActiveCount();
            return System.Text.Json.JsonSerializer.Serialize(playlists);
        }

        /// <summary>
        /// Возвращает JSON-строку со списком треков указанного плейлиста.
        /// </summary>
        /// <param name="playlistId">ID плейлиста.</param>
        /// <returns>JSON-строка с треками или "[]", если плейлист не найден.</returns>
        public string GetPlaylistTracksJson(int playlistId)
        {
            var playlist = _playlistManager.GetPlaylistById(playlistId);
            if (playlist == null) return "[]";
            var allTracks = _library.GetAllTracks();
            var tracks = playlist.TrackPaths
                .Select(path => allTracks.FirstOrDefault(t => t.FilePath == path))
                .Where(t => t != null)
                .ToList();
            return System.Text.Json.JsonSerializer.Serialize(tracks);
        }

        /// <summary>
        /// Создание плейлиста.
        /// </summary>
        /// <param name="name">Название плейлиста.</param>
        public void CreatePlaylist(string name) => _playlistManager.CreatePlaylist(name);

        /// <summary>
        /// Удаление плейлиста.
        /// </summary>
        /// <param name="id">Номер плейлиста.</param>
        public void DeletePlaylist(int id) => _playlistManager.DeletePlaylist(id);

        /// <summary>
        /// Изменение названия плейлиста.
        /// </summary>
        /// <param name="id">ID плейлиста.</param>
        /// <param name="newName">Новое название плейлиста.</param>
        public void RenamePlaylist(int id, string newName) => _playlistManager.RenamePlaylist(id, newName);

        /// <summary>
        /// Добавление трека в плейлист.
        /// </summary>
        /// <param name="playlistId">Номер плейлиста.</param>
        /// <param name="trackPath">Путь трека.</param>
        public void AddTrackToPlaylist(int playlistId, string trackPath) => _playlistManager.AddTrackToPlaylist(playlistId, trackPath);

        /// <summary>
        /// Удаление трека из плейлиста.
        /// </summary>
        /// <param name="playlistId">Номер плейлиста.</param>
        /// <param name="trackPath">Путь трека.</param>
        public void RemoveTrackFromPlaylist(int playlistId, string trackPath) => _playlistManager.RemoveTrackFromPlaylist(playlistId, trackPath);

        /// <summary>
        /// Проверяет, добавлен ли трек в указанный плейлист.
        /// </summary>
        /// <param name="playlistId">ID плейлиста.</param>
        /// <param name="trackPath">Путь к файлу трека.</param>
        /// <returns>true, если трек уже в плейлисте.</returns>
        public bool IsTrackInPlaylist(int playlistId, string trackPath) => _playlistManager.IsTrackInPlaylist(playlistId, trackPath);

        /// <summary>
        /// Возвращает путь к обложке первого трека в плейлисте.
        /// </summary>
        /// <param name="playlistId">ID плейлиста.</param>
        /// <returns>Путь к обложке или null, если треков нет.</returns>
        public string? GetFirstTrackCoverPath(int playlistId) => _playlistManager.GetFirstTrackCoverPath(playlistId);

        /// <summary>
        /// Открывает системный диалог выбора файла для обложки плейлиста.
        /// </summary>
        /// <returns>Полный путь к выбранному файлу изображения или null, если пользователь отменил выбор.</returns>
        public string? PickCoverImage()
        {
            var dialog = new Microsoft.Win32.OpenFileDialog
            {
                Filter = "Image files (*.jpg;*.jpeg;*.png)|*.jpg;*.jpeg;*.png",
                Title = "Select cover image"
            };

            return dialog.ShowDialog() == true ? dialog.FileName : null;
        }

        /// <summary>
        /// Устанавливает обложку плейлиста, копируя изображение в папку Covers.
        /// </summary>
        /// <param name="id">ID плейлиста.</param>
        /// <param name="sourcePath">Путь к исходному файлу изображения на диске пользователя.</param>
        public void SetPlaylistCover(int id, string sourcePath) => _playlistManager.SetPlaylistCover(id, sourcePath);

        /// <summary>
        /// Удаление обложки плейлиста.
        /// </summary>
        /// <param name="id">ID плейлиста.</param>
        public void RemovePlaylistCover(int id)
        {
            try { _playlistManager.RemovePlaylistCover(id); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка RemovePlaylistCover: {ex.Message}"); }
        }

        /// <summary>
        /// Удаляет неиспользуемые файлы обложек. Вызывается при закрытии приложения.
        /// </summary>
        public void CleanupOrphanedCovers()
        {
            try { _playlistManager.CleanupOrphanedCovers(); }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Ошибка CleanupOrphanedCovers: {ex.Message}"); }
        }

        /// <summary>
        /// Проверяет существование файла по указанному пути.
        /// </summary>
        /// <param name="path">Путь к файлу.</param>
        /// <returns>true, если файл существует.</returns>
        public bool FileExists(string path) => File.Exists(path);

        /// <summary>
        /// Возвращает время последнего изменения файла в виде Unix-таймстампа (миллисекунды).
        /// Используется для сброса кэша картинок в браузере при изменении файла.
        /// </summary>
        /// <param name="path">Путь к файлу.</param>
        /// <returns>Unix-таймстамп в миллисекундах или 0, если файл не найден.</returns>
        public long GetFileLastModified(string path)
        {
            var fullPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, path);
            if (!File.Exists(fullPath)) return 0;

            return new DateTimeOffset(File.GetLastWriteTimeUtc(fullPath)).ToUnixTimeMilliseconds();
        }


        // --- НАСТРОЙКИ ---

        /// <summary>
        /// Возвращает все сохранённые настройки приложения в виде JSON.
        /// </summary>
        /// <returns>JSON-объект вида "ключ": "значение" со всеми настройками.</returns>
        public string GetSettingsJson() => System.Text.Json.JsonSerializer.Serialize(_settingsManager.GetAll());

        /// <summary>
        /// Сохраняет значение настройки.
        /// </summary>
        /// <param name="key">Ключ настройки.</param>
        /// <param name="value">Новое значение настройки.</param>
        public void SetSetting(string key, string value) => _settingsManager.Set(key, value);

        /// <summary>
        /// Открывает системный диалог выбора папки.
        /// </summary>
        /// <returns>Выбранный путь к папке, или null, если пользователь отменил выбор.</returns>
        public string? PickFolder()
        {
            var dialog = new Microsoft.Win32.OpenFolderDialog
            {
                Title = "Select music folder"
            };

            return dialog.ShowDialog() == true ? dialog.FolderName : null;
        }

        /// <summary>
        /// Устанавливает новую папку с музыкой: сохраняет в настройках и применяет к библиотеке.
        /// </summary>
        /// <param name="path">Путь к папке.</param>
        public void SetMusicFolderPath(string path)
        {
            try
            {
                _settingsManager.Set("musicFolder", path);
                _library.SetMusicFolder(path);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Ошибка SetMusicFolderPath: {ex.Message}");
            }
        }
    }
}