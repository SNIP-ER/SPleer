using System.Collections.Concurrent;
using System.IO;
using System.Text.Json;
using System.Diagnostics;

namespace SPleer
{
    public class LoudnessInfo
    {
        public double RmsDb { get; set; }
        public long Size { get; set; }
        public long LastWrite { get; set; }
    }

    public class LoudnessCache
    {
        private readonly ConcurrentDictionary<string, LoudnessInfo> _items = new(StringComparer.OrdinalIgnoreCase);
        private readonly string _filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Loudness.json");
        private readonly object _saveLock = new();
        private int _analysisVersion;

        public LoudnessCache()
        {
            try
            {
                if (!File.Exists(_filePath)) return;

                var loaded = JsonSerializer.Deserialize<Dictionary<string, LoudnessInfo>>(File.ReadAllText(_filePath));
                if (loaded == null) return;

                foreach (var kv in loaded) _items[kv.Key] = kv.Value;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка загрузки Loudness.json: {ex.Message}");
            }
        }

        /// <summary>
        /// Возвращает громкость из кэша, если файл не менялся.
        /// </summary>
        /// <param name="path"></param>
        /// <param name="rmsDb"></param>
        /// <returns></returns>
        public bool TryGet(string path, out double rmsDb)
        {
            rmsDb = 0;

            try
            {
                if (!_items.TryGetValue(path, out var info)) return false;

                var fi = new FileInfo(path);
                if (!fi.Exists || fi.Length != info.Size || fi.LastWriteTimeUtc.Ticks != info.LastWrite) return false;

                rmsDb = info.RmsDb;

                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Берёт громкость из кэша или считает сразу (редкий случай — трек ещё не успели проанализировать).
        /// </summary>
        /// <param name="path"></param>
        /// <returns></returns>
        public double? GetOrAnalyze(string path)
        {
            if (TryGet(path, out var cached)) return cached;

            var result = Analyze(path);
            if (result != null) Save();

            return result;
        }

        /// <summary>
        /// Анализирует все треки в фоне. Новый вызов отменяет предыдущий.
        /// </summary>
        /// <param name="paths"></param>
        /// <returns></returns>
        public Task AnalyzeLibraryAsync(IReadOnlyList<string> paths)
        {
            int version = Interlocked.Increment(ref _analysisVersion);

            return Task.Run(() =>
            {
                bool changed = false;

                foreach (var path in paths)
                {
                    if (version != Volatile.Read(ref _analysisVersion)) break;
                    if (TryGet(path, out _)) continue;
                    if (Analyze(path) != null) changed = true;
                }

                if (changed) Save();
            });
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="path"></param>
        /// <returns></returns>
        private double? Analyze(string path)
        {
            try
            {
                var fi = new FileInfo(path);
                double sum = 0;
                long count = 0;

                using (var reader = AudioPlayer.CreateReader(path))
                {
                    var sp = NAudio.Wave.WaveExtensionMethods.ToSampleProvider(reader);
                    var buf = new float[sp.WaveFormat.SampleRate * sp.WaveFormat.Channels];
                    int read;

                    while ((read = sp.Read(buf.AsSpan())) > 0)
                    {
                        for (int i = 0; i < read; i++)
                        {
                            float sq = buf[i] * buf[i];
                            if (sq > 1e-7f) { sum += sq; count++; } // игнорируем тишину
                        }
                    }
                }

                if (count == 0) return null;
                double db = 10 * Math.Log10(sum / count);

                _items[path] = new LoudnessInfo
                {
                    RmsDb = db,
                    Size = fi.Length,
                    LastWrite = fi.LastWriteTimeUtc.Ticks
                };

                return db;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка анализа {path}: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 
        /// </summary>
        private void Save()
        {
            lock (_saveLock)
            {
                try { File.WriteAllText(_filePath, JsonSerializer.Serialize(_items)); }
                catch (Exception ex) { Debug.WriteLine($"Ошибка сохранения Loudness.json: {ex.Message}"); }
            }
        }
    }
}