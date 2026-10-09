using NAudio.SoundFile;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using System.IO;
using System.Diagnostics;

namespace SPleer
{
    public class AudioPlayer
    {
        // Устройство вывода
        private IWavePlayer? outputDevice;
        // Читатель аудиофайла
        private WaveStream? audioFile;
        private VolumeSampleProvider? volumeProvider;
        // Нормализация
        private VolumeSampleProvider? gainProvider;
        private LoudnessCache? _loudness;
        // Режим «Нормально»
        private double _targetRmsDb = -16.0;
        private double? _currentRmsDb;
        // Ссылка на библиотеку треков
        private MusicLibrary? _musicLibrary;
        // История треков
        private Stack<int> _history = new Stack<int>();
        // Явный порядок путей
        private List<string>? _activeOrder = null;
        // Текущий режим воспроизведения
        private PlaybackMode _currentMode = PlaybackMode.Sequential;
        // Путь к текущему файлу
        private string? currentFilePath;
        private string? _currentTrackPath = null;
        // Громкость, установленная пользователем
        private float _userVolume = 0.6f;
        private float _normalizedVolume = 1.0f;
        // Индекс текущего трека
        private int _currentTrackIndex = -1;
        // Флаг для кнопки repeat
        private bool _isRepeatOne = false;
        // Флаг для включения/выключения нормализации громкости
        private bool _normalizationEnabled = true;

        public bool IsPlaying => outputDevice?.PlaybackState == PlaybackState.Playing;
        // Текущая позиция в секундах
        public double CurrentPosition => audioFile?.CurrentTime.TotalSeconds ?? 0;
        // Длительность трека в секундах
        public double TotalDuration => audioFile?.TotalTime.TotalSeconds ?? 0;
        public WaveStream? AudioFile => audioFile;

        private static readonly string[] SoundFileExtensions = { ".ogg", ".flac", ".aiff", ".aif", ".opus" };


        // --- Воспроизведение ---

        /// <summary>
        /// Включает или выключает автоматическую нормализацию громкости при воспроизведении.
        /// </summary>
        /// <param name="enabled">true — нормализация включена.</param>
        public void SetNormalizationEnabled(bool enabled)
        {
            _normalizationEnabled = enabled;
            RecalcGain();
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

            if (!File.Exists(filePath))
            {
                Debug.WriteLine($"Файл не найден! Путь: {filePath}");
                return;
            }

            try
            {
                audioFile = CreateReader(filePath);
                _currentRmsDb = _loudness?.GetOrAnalyze(filePath);
                _normalizedVolume = CalcGain();

                // Цепочка: файл → под формат устройства → нормализация → лимитер → громкость пользователя
                ISampleProvider source = audioFile.ToSampleProvider();
                gainProvider = new VolumeSampleProvider(source) { Volume = _normalizedVolume };
                var limiter = new LimiterSampleProvider(gainProvider);
                volumeProvider = new VolumeSampleProvider(limiter) { Volume = _userVolume };

                outputDevice = CreateOutputDevice(volumeProvider);
                outputDevice.Play();
                currentFilePath = filePath;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка воспроизведения: {ex.Message}");
            }
        }

        /// <summary>
        /// Создаёт подходящий для формата файла аудио-ридер. Для .ogg используется VorbisWaveReader,
        /// для остальных поддерживаемых форматов — AudioFileReader.
        /// </summary>
        /// <param name="filePath">Путь к аудиофайлу.</param>
        /// <returns>Готовый к воспроизведению WaveStream.</returns>
        public static WaveStream CreateReader(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();

            if (SoundFileExtensions.Contains(ext))
            {
                return new SoundFileReader(filePath);
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
                volumeProvider.Volume = _userVolume;
        }


        // --- Нормализация, режимы громкости, вывод ---

        /// <summary>
        /// Передаёт плееру кэш громкости треков, из которого берутся данные для нормализации.
        /// </summary>
        /// <param name="cache">Кэш с заранее посчитанной громкостью треков.</param>
        public void SetLoudnessCache(LoudnessCache cache) => _loudness = cache;

        /// <summary>
        /// Вычисляет множитель усиления для текущего трека, чтобы его громкость
        /// приблизилась к целевой (зависит от выбранного режима громкости).
        /// Усиление ограничено диапазоном от -12 до +9 дБ.
        /// </summary>
        /// <returns>
        /// Линейный множитель громкости. Равен 1, если нормализация выключена
        /// или громкость текущего трека неизвестна.
        /// </returns>
        private float CalcGain()
        {
            if (!_normalizationEnabled || _currentRmsDb == null) return 1f;
            double db = Math.Clamp(_targetRmsDb - _currentRmsDb.Value, -12.0, 9.0);

            return (float)Math.Pow(10, db / 20.0);
        }

        /// <summary>
        /// Пересчитывает усиление нормализации и сразу применяет его к играющему треку.
        /// Вызывается при смене режима громкости или включении/выключении нормализации.
        /// </summary>
        private void RecalcGain()
        {
            _normalizedVolume = CalcGain();
            if (gainProvider != null) gainProvider.Volume = _normalizedVolume;
        }

        /// <summary>
        /// Устанавливает режим громкости, то есть целевой уровень, к которому подтягиваются все треки.
        /// Изменение применяется сразу, в том числе к играющему треку.
        /// </summary>
        /// <param name="mode">
        /// Режим: "loud" (громко), "normal" (нормально) или "quiet" (тихо). Регистр не учитывается.
        /// Любое другое значение трактуется как "normal".
        /// </param>
        public void SetLoudnessMode(string mode)
        {
            _targetRmsDb = mode.ToLowerInvariant() switch
            {
                "loud" => -12.0,
                "quiet" => -20.0,
                _ => -16.0
            };

            RecalcGain();
        }

        /// <summary>
        /// Создаёт и инициализирует устройство вывода звука (WASAPI, при ошибке — запасной WaveOut).
        /// Воспроизведение не запускается, для этого нужно вызвать Play у результата.
        /// </summary>
        /// <param name="provider">Цепочка обработки звука, которую нужно воспроизвести.</param>
        /// <returns>Инициализированное устройство вывода, готовое к воспроизведению.</returns>
        private static IWavePlayer CreateOutputDevice(ISampleProvider provider)
        {
            try
            {
                var player = new WasapiPlayerBuilder().Build();
                player.Init(provider.ToWaveProvider());

                return player;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"WASAPI недоступен, используем WaveOut: {ex.Message}");

                var waveOut = new WaveOut();
                waveOut.Init(provider);

                return waveOut;
            }
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
            _currentTrackPath = tracks[index].FilePath;
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
                // Текущий не сохраняется в истории при возврате
                _currentTrackIndex = prevIndex;
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
            // будет -1, если трек реально удалён
            _currentTrackIndex = newIndex;
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