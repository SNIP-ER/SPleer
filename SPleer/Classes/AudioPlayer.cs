using NAudio.Vorbis;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace SPleer
{
    public class AudioPlayer
    {
        private const float TargetNormalizedLevel = 0.6f; // Целевой уровень громкости после нормализации 

        private WaveOutEvent? outputDevice; // Устройство вывода
        private WaveStream? audioFile; // Читатель аудиофайла
        private VolumeSampleProvider? volumeProvider;
        private MusicLibrary? _musicLibrary;    // Ссылка на библиотеку треков (НЕ копия списка)
        private Stack<int> _history = new Stack<int>(); // История треков
        private List<string>? _activeOrder = null; // явный порядок путей
        private PlaybackMode _currentMode = PlaybackMode.Sequential;    // Текущий режим воспроизведения
        private string? currentFilePath;    // Путь к текущему файлу
        private string? _currentTrackPath = null;
        private float _userVolume = 0.4f;   // Громкость, установленная пользователем
        private float _normalizedVolume = 1.0f;
        private int _currentTrackIndex = -1;    // Индекс текущего трека
        private bool _isRepeatOne = false;  // Флаг для кнопки repeat
        private bool _normalizationEnabled = true;  // Флаг для включения/выключения нормализации громкости

        public bool IsPlaying => outputDevice?.PlaybackState == PlaybackState.Playing;
        public double CurrentPosition => audioFile?.CurrentTime.TotalSeconds ?? 0; // Текущая позиция в секундах
        public double TotalDuration => audioFile?.TotalTime.TotalSeconds ?? 0; // Длительность трека в секундах
        public WaveStream? AudioFile => audioFile;


        // --- Воспроизведение ---

        /// <summary>
        /// Включает или выключает автоматическую нормализацию громкости при воспроизведении.
        /// </summary>
        /// <param name="enabled">true — нормализация включена.</param>
        public void SetNormalizationEnabled(bool enabled)
        {
            _normalizationEnabled = enabled;
        }

        /// <summary>
        /// Начало воспроизведения.
        /// </summary>
        /// <remarks>
        /// Суть:
        /// Находится самый громкий пик в файле, и громкость подгоняется так,
        /// чтобы этот пик был на уровне 80% от технического максимума формата файла.
        /// </remarks>
        public void PlayWithNormalization(string filePath)
        {
            // Освобождение текущих ресурсов
            if (outputDevice != null)
            {
                outputDevice.Stop();
                outputDevice.Dispose();
                outputDevice = null;
            }

            if (audioFile != null)
            {
                audioFile.Dispose();
                audioFile = null;
            }

            currentFilePath = null;

            // Проверка на существование файла
            if (!System.IO.File.Exists(filePath))
            {
                System.Diagnostics.Debug.WriteLine($"Файл не найден! Путь: {filePath}");
                return;
            }

            try
            {
                float normalizedVolume = 1.0f;

                if (_normalizationEnabled)
                {
                    float maxPeak = 0;
                    using (var reader = CreateReader(filePath))
                    {
                        var sampleProvider = reader.ToSampleProvider();
                        float[] buffer = new float[reader.WaveFormat.SampleRate];
                        int samplesRead;
                        do
                        {
                            samplesRead = sampleProvider.Read(buffer, 0, buffer.Length);
                            for (int i = 0; i < samplesRead; i++)
                            {
                                float sampleAbs = Math.Abs(buffer[i]);
                                if (sampleAbs > maxPeak) maxPeak = sampleAbs;
                            }
                        }
                        while (samplesRead > 0);
                    }
                    normalizedVolume = maxPeak > 0 ? Math.Min(1.0f, TargetNormalizedLevel / maxPeak) : 1.0f;
                }

                audioFile = CreateReader(filePath);
                outputDevice = new WaveOutEvent();

                _normalizedVolume = normalizedVolume;

                volumeProvider = new VolumeSampleProvider(audioFile.ToSampleProvider())
                {
                    Volume = normalizedVolume * _userVolume
                };

                outputDevice.Init(volumeProvider);
                outputDevice.Play();
                currentFilePath = filePath;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Ошибка воспроизведения: {ex.Message}");
            }
        }

        /// <summary>
        /// Создаёт подходящий для формата файла аудио-ридер. Для .ogg используется VorbisWaveReader,
        /// для остальных поддерживаемых форматов — AudioFileReader.
        /// </summary>
        /// <param name="filePath">Путь к аудиофайлу.</param>
        /// <returns>Готовый к воспроизведению WaveStream.</returns>
        private WaveStream CreateReader(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();

            if (ext == ".ogg")
            {
                return new VorbisWaveReader(filePath);
            }

            return new AudioFileReader(filePath);
        }

        /// <summary>
        /// Остановка воспроизведения без сброса позиции.
        /// </summary>
        public void Pause()
        {
            if (outputDevice?.PlaybackState == PlaybackState.Playing)
            {
                outputDevice.Pause();
            }
        }

        /// <summary>
        /// Продолжение воспроизведения с текущей позиции.
        /// </summary>
        public void Resume()
        {
            if (outputDevice?.PlaybackState == PlaybackState.Paused)
            {
                outputDevice.Play();
            }
        }

        /// <summary>
        /// Остановка воспроизведения и сброс позиции.
        /// </summary>
        public void Stop()
        {
            if (outputDevice != null)
            {
                outputDevice.Stop();
                outputDevice.Dispose();
                outputDevice = null;
            }

            if (audioFile != null)
            {
                audioFile.Dispose();
                audioFile = null;
            }

            currentFilePath = null;
        }


        // --- Громкость ---

        /// <summary>
        /// Получение громкости от 0.0 до 1.0
        /// </summary>
        public float Volume
        {
            get => _userVolume;
            set => _userVolume = Math.Clamp(value, 0.0f, 1.0f);
        }

        /// <summary>
        /// Устанвока громкости воспроизведения.
        /// </summary>
        /// <param name="volume">Число от 0.0 до 1.0 .</param>
        public void SetVolume(float volume)
        {
            // Ограничение диапазона от 0.0 до 1.0
            Volume = volume;
            ApplyUserVolume();
        }

        /// <summary>
        /// Применить пользовательскую громкость к текущему треку
        /// </summary>
        public void ApplyUserVolume()
        {
            if (volumeProvider != null)
                volumeProvider.Volume = _normalizedVolume * _userVolume;
        }


        // --- Навигация по трекам ---

        /// <summary>
        /// Установить ссылку на MusicLibrary.
        /// </summary>
        /// <param name="library"></param>
        public void SetMusicLibrary(MusicLibrary library)
        {
            _musicLibrary = library;
        }

        /// <summary>
        /// Воспроизвести трек по индексу в списке.
        /// </summary>
        /// <param name="index">Индекс трека, целое число.</param>
        public void PlayByIndex(int index)
        {
            var tracks = _musicLibrary.GetAllTracks();
            if (tracks.Count == 0 || index < 0 || index >= tracks.Count) return;

            if (_currentTrackIndex >= 0 && _currentTrackIndex != index)
            {
                _history.Push(_currentTrackIndex);
            }

            _currentTrackIndex = index;
            _currentTrackPath = tracks[index].FilePath; // запоминаем путь, а не только индекс
            PlayWithNormalization(tracks[index].FilePath);
        }

        /// <summary>
        /// Выбор следующего трека, в зависимости от режима
        /// </summary>
        public void PlayNext()
        {
            if (_musicLibrary == null) return;

            var allTracks = _musicLibrary.GetAllTracks();
            if (allTracks.Count == 0) return;

            // Порядок для навигации: явный (сортировка/поиск/плейлист) или порядок библиотеки
            List<string> orderPaths = _activeOrder ?? allTracks.Select(t => t.FilePath).ToList();
            if (orderPaths.Count == 0) return;

            string? currentPath = _currentTrackIndex >= 0 ? allTracks[_currentTrackIndex].FilePath : null;

            // Повтор трека
            if (_isRepeatOne && currentPath != null && orderPaths.Contains(currentPath))
            {
                PlayByIndex(_currentTrackIndex);
                return;
            }

            if (_currentTrackIndex >= 0)
            {
                _history.Push(_currentTrackIndex);
            }

            string nextPath;
            if (_currentMode == PlaybackMode.Shuffle)
            {
                if (orderPaths.Count == 1)
                {
                    nextPath = orderPaths[0];
                }
                else
                {
                    do
                    {
                        nextPath = orderPaths[Random.Shared.Next(orderPaths.Count)];
                    }
                    while (nextPath == currentPath);
                }
            }
            else
            {
                int currentOrderIndex = currentPath != null ? orderPaths.IndexOf(currentPath) : -1;
                int nextOrderIndex = (currentOrderIndex + 1) % orderPaths.Count;
                nextPath = orderPaths[nextOrderIndex];
            }

            int nextLibraryIndex = allTracks.ToList().FindIndex(t => t.FilePath == nextPath);
            if (nextLibraryIndex == -1) return;

            PlayByIndex(nextLibraryIndex);
        }

        /// <summary>
        /// Предыдущий трек
        /// </summary>
        public void PlayPrevious()
        {
            if (_musicLibrary == null) return;

            var allTracks = _musicLibrary.GetAllTracks();
            if (allTracks.Count == 0) return;

            if (_history.Count > 0)
            {
                int prevIndex = _history.Pop();
                _currentTrackIndex = prevIndex;     // Текущий не сохраняется в истории при возврате
                PlayWithNormalization(allTracks[prevIndex].FilePath);
                return;
            }

            List<string> orderPaths = _activeOrder ?? allTracks.Select(t => t.FilePath).ToList();
            if (orderPaths.Count == 0) return;

            string? currentPath = _currentTrackIndex >= 0 ? allTracks[_currentTrackIndex].FilePath : null;
            int currentOrderIndex = currentPath != null ? orderPaths.IndexOf(currentPath) : 0;
            int prevOrderIndex = currentOrderIndex <= 0 ? orderPaths.Count - 1 : currentOrderIndex - 1;

            int prevLibraryIndex = allTracks.ToList().FindIndex(t => t.FilePath == orderPaths[prevOrderIndex]);
            if (prevLibraryIndex == -1) return;

            _currentTrackIndex = prevLibraryIndex;
            PlayWithNormalization(allTracks[prevLibraryIndex].FilePath);
        }

        /// <summary>
        /// Запуск первого трека, если ничего не выбрано.
        /// </summary>
        public void PlayFirstIfNotPlaying()
        {
            if (_currentTrackIndex < 0)
            {
                PlayByIndex(0);
            }
        }

        /// <summary>
        /// Задаёт явный порядок треков для навигации "следующий"/"предыдущий".
        /// Используется для плейлистов, результатов поиска и сортированного отображения.
        /// Если null — навигация идёт по порядку самой библиотеки.
        /// </summary>
        public void SetActiveOrder(List<string>? orderedPaths)
        {
            _activeOrder = orderedPaths;
        }


        // --- Режим/повтор ---

        /// <summary>
        /// Установить режим воспроизведения.
        /// </summary>
        /// <param name="mode">Выбранный режим воспроизведения.</param>
        public void SetMode(PlaybackMode mode)
        {
            _currentMode = mode;
        }

        /// <summary>
        /// Получить текущий режим.
        /// </summary>
        /// <returns>Текущий режим воспроизведения, тип - PlaybackMode.</returns>
        public PlaybackMode GetMode()
        {
            return _currentMode;
        }

        /// <summary>
        /// Переключает режим повтора одного трека.
        /// </summary>
        public void ToggleRepeatOne()
        {
            _isRepeatOne = !_isRepeatOne;
        }

        /// <summary>
        /// Возвращает, включён ли режим повтора одного трека.
        /// </summary>
        /// <returns>true, если повтор одного трека активен.</returns>
        public bool IsRepeatOn()
        {
            return _isRepeatOne;
        }


        // --- Состояние текущего трека ---

        /// <summary>
        /// Получение индекса текущего трека.
        /// </summary>
        /// <returns>Индекс - целое число.</returns>
        public int GetCurrentTrackIndex()
        {
            return _currentTrackIndex;
        }

        /// <summary>
        /// Возвращает путь к файлу текущего воспроизводимого трека.
        /// </summary>
        /// <returns>Путь к файлу или null.</returns>
        public string? GetCurrentTrackPath()
        {
            return _currentTrackPath;
        }

        /// <summary>
        /// Устанавливает индекс текущего трека.
        /// </summary>
        /// <param name="index">Индекс трека (0 — первый).</param>
        public void SetCurrentTrackIndex(int index)
        {
            _currentTrackIndex = index;
        }

        /// <summary>
        /// Пересчет _currentTrackIndex.
        /// </summary>
        public void SyncCurrentTrackIndex()
        {
            if (_currentTrackPath == null || _musicLibrary == null) return;

            var tracks = _musicLibrary.GetAllTracks().ToList();
            var newIndex = tracks.FindIndex(t => t.FilePath == _currentTrackPath);
            _currentTrackIndex = newIndex; // будет -1, если трек реально удалён
        }

        /// <summary>
        /// Обновляет путь текущего трека после переименования файла на диске, если играл именно он.
        /// </summary>
        /// <param name="oldPath">Старый путь файла.</param>
        /// <param name="newPath">Новый путь файла.</param>
        public void RenameCurrentTrackPath(string oldPath, string newPath)
        {
            if (_currentTrackPath == oldPath)
            {
                _currentTrackPath = newPath;
                SyncCurrentTrackIndex();
            }
        }
    }
}