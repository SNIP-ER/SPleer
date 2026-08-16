public class SettingsManager
{
    private Dictionary<string, string> _settings;
    private readonly string _filePath;

    public SettingsManager()
    {
        _filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Settings.json");
        Load();
    }

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

    public string? Get(string key) => _settings.TryGetValue(key, out var value) ? value : null;

    public IReadOnlyDictionary<string, string> GetAll() => _settings;
}