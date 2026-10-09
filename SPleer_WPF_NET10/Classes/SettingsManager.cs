using System.IO;

public class SettingsManager
{
    private Dictionary<string, string> _settings;
    private readonly string _filePath;

    public SettingsManager()
    {
        _filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Settings.json");
        Load();
    }

    /// <summary>
    /// Загружает настройки из файла Settings.json. Если файл отсутствует или пуст,
    /// создаётся пустой набор настроек.
    /// </summary>
    private void Load()
    {
        if (File.Exists(_filePath))
        {
            var json = File.ReadAllText(_filePath);
            _settings = string.IsNullOrWhiteSpace(json)
                ? new Dictionary<string, string>()
                : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new();
        }
        else
        {
            _settings = new Dictionary<string, string>();
        }
    }

    /// <summary>
    /// Сохранение настроек.
    /// </summary>
    private void Save()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(_settings);
        File.WriteAllText(_filePath, json);
    }

    /// <summary>
    /// Применить изменение значений.
    /// </summary>
    /// <param name="key">Ключ параметра.</param>
    /// <param name="value">Новое значение.</param>
    public void Set(string key, string value)
    {
        _settings[key] = value;
        Save();
    }

    /// <summary>
    /// Возвращает значение настройки по ключу.
    /// </summary>
    /// <param name="key">Ключ настройки.</param>
    /// <returns>Значение настройки или null, если такого ключа нет.</returns>
    public string? Get(string key) => _settings.TryGetValue(key, out var value) ? value : null;

    /// <summary>
    /// Возвращает все сохранённые настройки.
    /// </summary>
    /// <returns>Набор настроек вида "ключ": "значение" только для чтения.</returns>
    public IReadOnlyDictionary<string, string> GetAll() => _settings;
}