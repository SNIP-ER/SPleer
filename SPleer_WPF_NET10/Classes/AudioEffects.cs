using NAudio.Wave;

namespace SPleer
{
    /// <summary>Мягкий лимитер: прижимает пики выше порога к 1.0.</summary>
    public class LimiterSampleProvider : ISampleProvider
    {
        private const float Threshold = 0.9f;
        private readonly ISampleProvider _source;

        public LimiterSampleProvider(ISampleProvider source) => _source = source;
        public WaveFormat WaveFormat => _source.WaveFormat;

        /// <summary>
        /// Читает звук из источника и мягко ограничивает пики выше порога, чтобы избежать клиппинга.
        /// </summary>
        /// <param name="buffer">Буфер, который заполняется обработанными семплами.</param>
        /// <returns>Количество семплов, записанных в буфер. 0 означает конец потока.</returns>
        public int Read(Span<float> buffer)
        {
            int read = _source.Read(buffer);
            for (int i = 0; i < read; i++)
            {
                float a = Math.Abs(buffer[i]);
                if (a > Threshold)
                    buffer[i] = Math.Sign(buffer[i]) *
                        (Threshold + (1f - Threshold) * MathF.Tanh((a - Threshold) / (1f - Threshold)));
            }
            return read;
        }
    }
}