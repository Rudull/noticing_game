// Módulo para analizar subtítulos y encontrar palabras de frecuencia
window.SubtitleAnalysis = (function () {
  // Función para verificar si el contexto de la extensión es válido
  function isExtensionContextValid() {
    try {
      // Verificar si chrome y chrome.runtime están disponibles
      if (!chrome || !chrome.runtime) {
        return false;
      }

      // Verificar si el runtime id está disponible (indica contexto válido)
      if (!chrome.runtime.id) {
        return false;
      }

      // Verificar si lastError indica que el contexto se invalidó
      if (chrome.runtime.lastError) {
        console.warn(
          "Chrome runtime error detected:",
          chrome.runtime.lastError.message,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.warn("Extension context validation error:", error);
      return false;
    }
  }

  // Función para manejar contexto invalidado
  function handleInvalidContext() {
    console.log(
      "Extension context invalidated in SubtitleAnalysis, cleaning up...",
    );

    // Notificar al usuario si es posible
    try {
      const statusElements = document.querySelectorAll(".noticing-game-status");
      statusElements.forEach((element) => {
        element.textContent =
          "Extension reloaded. Please refresh the page to continue using Noticing Game.";
        element.style.color = "orange";
      });
    } catch (error) {
      console.warn("Could not update status elements:", error);
    }
  }

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
    window.lastAnalyzedVideoId = null;

    return new Promise((resolve) => {
      // Verificar contexto antes de usar Chrome APIs
      if (!isExtensionContextValid()) {
        handleInvalidContext();
        resolve({
          success: false,
          error: "Extension context invalidated. Please refresh the page.",
        });
        return;
      }

      try {
        chrome.storage.local.get(
          ["frequencyWordList"],
          async function (result) {
            try {
              // Verificar contexto nuevamente en el callback
              if (!isExtensionContextValid()) {
                handleInvalidContext();
                resolve({
                  success: false,
                  error: "Extension context invalidated during analysis.",
                });
                return;
              }

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
                const subtitlesResult =
                  await window.SubtitleExtraction.getYouTubeSubtitles();

                if (!subtitlesResult.success) {
                  resolve({
                    success: false,
                    error:
                      subtitlesResult.error || "Could not obtain subtitles",
                  });
                  return;
                }

                const subtitles = subtitlesResult.subtitles;
                console.log(
                  `Noticing Game: Subtitles obtained, processing ${subtitles.length} segments`,
                );

                // Combinar todos los subtítulos en un solo texto
                let fullText = subtitles.join(" ").replace(/<[^>]*>/g, ""); // Eliminar etiquetas HTML

                // Procesar usando el nuevo TextProcessing
                const words = window.TextProcessing.extractCleanWords(fullText);
                console.log(
                  `Noticing Game: Extracted ${words.length} total words in the video`,
                );

                // Contador de palabras
                const wordCounts = {};

                // Contar palabras y contracciones que están en la lista de frecuencia
                let matchCount = 0;
                words.forEach((word) => {
                  if (frequencyWordList.includes(word)) {
                    wordCounts[word] = (wordCounts[word] || 0) + 1;
                    matchCount++;
                  }
                });

                console.log(
                  `Noticing Game: Found ${Object.keys(wordCounts).length} unique words/contractions from the list (${matchCount} total matches)`,
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
                if (
                  error.message &&
                  error.message.includes("Extension context invalidated")
                ) {
                  handleInvalidContext();
                }
                resolve({
                  success: false,
                  error: error.message || "Unknown error during analysis",
                });
              }
            } catch (error) {
              console.error("Error in analyzeSubtitles callback:", error);
              if (
                error.message &&
                error.message.includes("Extension context invalidated")
              ) {
                handleInvalidContext();
              }
              resolve({
                success: false,
                error: "Error accessing storage: " + error.message,
              });
            }
          },
        );
      } catch (error) {
        console.error("Error in analyzeSubtitles:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        resolve({
          success: false,
          error: "Error initializing analysis: " + error.message,
        });
      }
    });
  }

  return {
    analyzeSubtitles,
  };
})();
