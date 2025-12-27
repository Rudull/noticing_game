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
    let currentVideoId = null;
    if (window.YouTubeVideoUtils && typeof window.YouTubeVideoUtils.getYouTubeVideoId === "function") {
      currentVideoId = window.YouTubeVideoUtils.getYouTubeVideoId();
    }
    // Fallback para Netflix u otros sitios
    if (!currentVideoId) {
      currentVideoId = window.location.href;
    }

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
                  await window.SubtitleExtraction.getSubtitles();

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

                // Handling for Live Capture mode (e.g. Netflix fallback)
                // When we can't get full subtitles upfront, we pre-fill the grid with the target list
                // so the user can see what to look for while the game detects matches in real-time.
                if (subtitlesResult.liveCapture && subtitles.length === 0) {
                  console.log("Noticing Game: Live Capture mode detected with empty history. Pre-filling grid.");

                  // Create results from the full list with 0 counts
                  // This allows the grid to be populated
                  const results = frequencyWordList.map(word => ({
                    word: word,
                    count: 0 // Initial count
                  }));

                  // Keep original order or shuffle? Default list order is usually frequency based.

                  resolve({
                    success: true,
                    words: results,
                    language: subtitlesResult.language,
                    source: subtitlesResult.source || "page",
                    liveCapture: true
                  });
                  return;
                }

                // Combinar todos los subtítulos en un solo texto
                let fullText = subtitles.join(" ").replace(/<[^>]*>/g, ""); // Eliminar etiquetas HTML

                // Usar countMatches para contar palabras y frases
                let wordCounts = {};
                let matchCount = 0;

                if (window.TextProcessing && typeof window.TextProcessing.countMatches === "function") {
                  wordCounts = window.TextProcessing.countMatches(fullText, frequencyWordList);

                  // Calcular total de coincidencias
                  Object.values(wordCounts).forEach(count => {
                    matchCount += count;
                  });
                } else {
                  // Fallback: comportamiento anterior (solo palabras sueltas)
                  const words = window.TextProcessing.extractCleanWords(fullText);
                  words.forEach((word) => {
                    if (frequencyWordList.includes(word)) {
                      wordCounts[word] = (wordCounts[word] || 0) + 1;
                      matchCount++;
                    }
                  });
                }

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
