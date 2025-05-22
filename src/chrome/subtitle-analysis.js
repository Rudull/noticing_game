// Módulo para analizar subtítulos y encontrar palabras de frecuencia
window.SubtitleAnalysis = (function () {
  // Función para analizar subtítulos y encontrar palabras de la lista
  async function analyzeSubtitles() {
    console.log("Noticing Game: Starting fresh subtitle analysis");

    // Obtener el ID del video actual
    const currentVideoId = window.YouTubeVideoUtils.getYouTubeVideoId();

    // Siempre reiniciar el estado completamente
    console.log(
      "Noticing Game: Completely resetting detection state for new analysis",
    );

    // Limpiar palabras recientes y notadas
    if (window.WordDetection) {
      Object.keys(window.WordDetection.recentWords).forEach(
        (key) => delete window.WordDetection.recentWords[key],
      );
      Object.keys(window.WordDetection.notedWords).forEach(
        (key) => delete window.WordDetection.notedWords[key],
      );
    }

    // Forzar un nuevo análisis descartando resultados anteriores
    window.lastAnalyzedVideoId = null; // Esto fuerza a tratar este video como nuevo

    // Obtener la lista de palabras de frecuencia
    return new Promise((resolve) => {
      chrome.storage.local.get(["frequencyWordList"], async function (result) {
        if (
          !result.frequencyWordList ||
          result.frequencyWordList.length === 0
        ) {
          resolve({
            success: false,
            error:
              "No word list configured. Please set it up in the extension.",
          });
          return;
        }

        console.log(
          `Noticing Game: Word list loaded, contains ${result.frequencyWordList.length} words`,
        );
        const frequencyWordList = result.frequencyWordList;

        try {
          // IMPORTANTE: Forzar nueva extracción de subtítulos ignorando cualquier caché
          const subtitlesResult =
            await window.SubtitleExtraction.getYouTubeSubtitles();

          if (!subtitlesResult.success) {
            resolve({
              success: false,
              error: subtitlesResult.error || "Could not obtain subtitles",
            });
            return;
          }

          const subtitles = subtitlesResult.subtitles;
          console.log(
            `Noticing Game: Subtitles obtained, processing ${subtitles.length} segments`,
          );

          // Combinar todos los subtítulos en un solo texto
          let fullText = subtitles
            .join(" ")
            .replace(/<[^>]*>/g, "") // Eliminar etiquetas HTML
            .toLowerCase();

          // Mejorar procesamiento de palabras para detectar correctamente palabras junto a comillas
          // Paso 1: Pre-procesar el texto original para normalizar espacios entre puntuación
          let processedText = fullText;

          // Insertar espacios alrededor de cada signo de puntuación
          processedText = processedText.replace(
            /([.,?!;'"\(\)\[\]{}:\/\\])/g,
            " $1 ",
          );

          // Normalizar espacios (eliminar múltiples espacios)
          processedText = processedText
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

          // Extraer solo las palabras, excluyendo los signos de puntuación
          const words = processedText
            .split(" ")
            .filter(
              (w) => w.length > 0 && !/^[.,?!;'"\(\)\[\]{}:\/\\]+$/.test(w),
            );

          console.log(
            `Noticing Game: Extracted ${words.length} total words in the video`,
          );

          // Contador de palabras
          const wordCounts = {};

          // Contar palabras que están en la lista de frecuencia
          let matchCount = 0;
          words.forEach((word) => {
            if (frequencyWordList.includes(word)) {
              wordCounts[word] = (wordCounts[word] || 0) + 1;
              matchCount++;
            }
          });

          console.log(
            `Noticing Game: Found ${Object.keys(wordCounts).length} unique words from the list (${matchCount} total matches)`,
          );

          // Convertir a array de resultados
          const results = Object.keys(wordCounts).map((word) => ({
            word: word,
            count: wordCounts[word],
          }));

          // Ordenar por frecuencia (mayor a menor)
          results.sort((a, b) => b.count - a.count);

          console.log(`Noticing Game: Analysis completed successfully`);

          // Al finalizar, actualizar el ID del video analizado
          window.lastAnalyzedVideoId = currentVideoId;

          resolve({
            success: true,
            words: results,
            language: subtitlesResult.language,
            source: subtitlesResult.source || "page",
          });
        } catch (error) {
          console.error("Noticing Game: Error in analysis:", error);
          resolve({
            success: false,
            error: error.message || "Unknown error during analysis",
          });
        }
      });
    });
  }

  return {
    analyzeSubtitles,
  };
})();
