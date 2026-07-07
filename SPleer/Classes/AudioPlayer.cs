using NAudio.Wave;

namespace SPleer
{
    public class AudioPlayer
    {
        private WaveOutEvent? outputDevice; // Устройство вывода
        private AudioFileReader? audioFile; // Читатель аудиофайла
        private string? currentFilePath;    // Путь к текущему файлу
        private float _userVolume = 0.4f;   // Громкость, установленная пользователем
        private float _normalizedVolume = 1.0f;
        private const float TargetNormalizedLevel = 0.6f; // Целевой уровень громкости после нормализации        
        private MusicLibrary? _musicLibrary;    // Ссылка на библиотеку треков (НЕ копия списка)
        private int _currentTrackIndex = -1;    // Индекс текущего трека
        private PlaybackMode _currentMode = PlaybackMode.Sequential;    // Текущий режим воспроизведения
        private Stack<int> _history = new Stack<int>(); // История треков
        private bool _isRepeatOne = false;  // Флаг для кнопки repeat
        private List<string>? _playlistTrackPaths = null;  // Пути треков текущего плейлиста

        public bool IsPlaying => outputDevice?.PlaybackState == PlaybackState.Playing;
        public double CurrentPosition => audioFile?.CurrentTime.TotalSeconds ?? 0; // Текущая позиция в секундах
        public double TotalDuration => audioFile?.TotalTime.TotalSeconds ?? 0; // Длительность трека в секундах
        public AudioFileReader? AudioFile => audioFile;


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
                float maxPeak = 0;
                // Создаем буфер для чтения сэмплов
                using (var reader = new AudioFileReader(filePath))
                {
                    float[] buffer = new float[reader.WaveFormat.SampleRate];
                    int samplesRead;
                    do
                    {
                        samplesRead = reader.Read(buffer, 0, buffer.Length);
                        for (int i = 0; i < samplesRead; i++)
                        {
                            float sampleAbs = Math.Abs(buffer[i]);
                            if (sampleAbs > maxPeak) maxPeak = sampleAbs;
                        }
                    }
                    while (samplesRead > 0);
                }

                audioFile = new AudioFileReader(filePath);
                outputDevice = new WaveOutEvent();

                // Вычисляем громкость так, чтобы пик файла был на заданном уровне
                float normalizedVolume = maxPeak > 0 ? Math.Min(1.0f, TargetNormalizedLevel / maxPeak) : 1.0f;
                _normalizedVolume = normalizedVolume;
                audioFile.Volume = normalizedVolume * _userVolume;

                outputDevice.Init(audioFile);
                outputDevice.Play();
                currentFilePath = filePath;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Ошибка воспроизведения: {ex.Message}");
            }
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
            if (audioFile != null)
                audioFile.Volume = _normalizedVolume * _userVolume; ;
        }


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
            if (_musicLibrary == null) return;

            var tracks = _musicLibrary.GetAllTracks();

            if (tracks.Count == 0) return;
            if (index < 0 || index >= tracks.Count) return;

            // Сохранение индекса текущего трека в историю перед сменой
            if (_currentTrackIndex >= 0 && _currentTrackIndex != index)
            {
                _history.Push(_currentTrackIndex);
            }

            _currentTrackIndex = index;
            PlayWithNormalization(tracks[index].FilePath);
        }

        /// <summary>
        /// Выбор следующего трека, в зависимости от режима
        /// </summary>
        public void PlayNext()
        {
            if (_musicLibrary == null) return;

            var allTracks = _musicLibrary.GetAllTracks();
            var allTracksList = allTracks.ToList();
            if (allTracks.Count == 0) return;

            // Если задан плейлист
            List<Track> tracks;
            if (_playlistTrackPaths != null)
            {
                tracks = allTracks.Where(t => _playlistTrackPaths.Contains(t.FilePath)).ToList();
                if (tracks.Count == 0) return;
            }
            else
            {
                tracks = allTracks.ToList();
            }

            // Повтор трека
            if (_isRepeatOne && _currentTrackIndex >= 0)
            {
                var currentTrack = allTracks[_currentTrackIndex];
                if (_playlistTrackPaths == null || _playlistTrackPaths.Contains(currentTrack.FilePath))
                {
                    PlayByIndex(_currentTrackIndex);
                    return;
                }
            }

            if (_currentTrackIndex >= 0)
            {
                _history.Push(_currentTrackIndex);
            }

            int nextIndex;
            if (_currentMode == PlaybackMode.Shuffle)
            {
                if (tracks.Count == 1)
                {
                    nextIndex = 0;
                }
                else
                {
                    do
                    {
                        nextIndex = allTracksList.IndexOf(tracks[Random.Shared.Next(tracks.Count)]);
                    }
                    while (nextIndex == _currentTrackIndex);
                }
            }
            else
            {
                // Последовательно по кругу
                var currentPlaylistIndex = tracks.FindIndex(t => t.FilePath == allTracks[_currentTrackIndex].FilePath);
                var nextPlaylistIndex = (currentPlaylistIndex + 1) % tracks.Count;

                nextIndex = allTracksList.IndexOf(tracks[nextPlaylistIndex]);
            }

            PlayByIndex(nextIndex);
        }

        /// <summary>
        /// Предыдущий трек
        /// </summary>
        public void PlayPrevious()
        {
            if (_musicLibrary == null) return;

            var tracks = _musicLibrary.GetAllTracks();

            if (tracks.Count == 0) return;

            if (_history.Count > 0)
            {
                int prevIndex = _history.Pop();
                _currentTrackIndex = prevIndex;     // Текущий не сохраняется в истории при возврате
                PlayWithNormalization(tracks[prevIndex].FilePath);
            }
            else
            {
                int prevIndex;
                if (_currentTrackIndex <= 0)
                {
                    prevIndex = tracks.Count - 1;
                }
                else
                {
                    prevIndex = _currentTrackIndex - 1;
                }

                _currentTrackIndex = prevIndex;
                PlayWithNormalization(tracks[prevIndex].FilePath);
            }
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
        /// Получение индекса текущего трека.
        /// </summary>
        /// <returns>Индекс - целое число.</returns>
        public int GetCurrentTrackIndex()
        {
            return _currentTrackIndex;
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

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public string? GetCurrentTrackPath()
        {
            if (_currentTrackIndex >= 0 && _musicLibrary != null)
            {
                var tracks = _musicLibrary.GetAllTracks();

                if (_currentTrackIndex < tracks.Count)
                    return tracks[_currentTrackIndex].FilePath;
            }
            return null;
        }

        /// <summary>
        /// Устанавливает список треков для воспроизведения в режиме плейлиста.
        /// Если null — воспроизводится вся библиотека.
        /// </summary>
        public void SetPlaylistTracks(List<string>? trackPaths)
        {
            _playlistTrackPaths = trackPaths;
        }
    }
}