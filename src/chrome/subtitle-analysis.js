// Módulo para analizar subtítulos y encontrar palabras de frecuencia
window.SubtitleAnalysis = (function() {
  // Función para analizar subtítulos y encontrar palabras de la lista
  async function analyzeSubtitles() {
    console.log("Noticing Game: Starting subtitle analysis");

    // Obtener la lista de palabras de frecuencia
    return new Promise((resolve) => {
      chrome.storage.local.get(["frequencyWordList"], async function (result) {
        if (!result.frequencyWordList || result.frequencyWordList.length === 0) {
          resolve({
            success: false,
            error: "No word list configured. Please set it up in the extension."
          });
          return;
        }

        console.log(`Noticing Game: Word list loaded, contains ${result.frequencyWordList.length} words`);
        const frequencyWordList = result.frequencyWordList;

        try {
          // Obtener subtítulos usando el método mejorado
          const subtitlesResult = await window.SubtitleExtraction.getYouTubeSubtitles();

          if (!subtitlesResult.success) {
            resolve({
              success: false,
              error: subtitlesResult.error || "Could not obtain subtitles"
            });
            return;
          }

          const subtitles = subtitlesResult.subtitles;
          console.log(`Noticing Game: Subtitles obtained, processing ${subtitles.length} segments`);

          // Combinar todos los subtítulos en un solo texto
          let fullText = subtitles
            .join(" ")
            .replace(/<[^>]*>/g, "") // Eliminar etiquetas HTML
            .toLowerCase();

          // Extraer palabras del texto
          const words = fullText
            .split(/\s+/)
            .map((word) => word.replace(/[.,?!;\"'\(\)\[\]{}:\/\\]/g, "")) // Eliminar puntuación
            .map((word) => word.toLowerCase()) // Convertir a minúsculas
            .filter((word) => word.length > 0); // Filtrar palabras vacías

          console.log(`Noticing Game: Extracted ${words.length} total words in the video`);

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

          console.log(`Noticing Game: Found ${Object.keys(wordCounts).length} unique words from the list (${matchCount} total matches)`);

          // Convertir a array de resultados
          const results = Object.keys(wordCounts).map((word) => ({
            word: word,
            count: wordCounts[word]
          }));

          // Ordenar por frecuencia (mayor a menor)
          results.sort((a, b) => b.count - a.count);

          console.log(`Noticing Game: Analysis completed successfully`);
          resolve({
            success: true,
            words: results,
            language: subtitlesResult.language,
            source: subtitlesResult.source || "page"
          });
        } catch (error) {
          console.error("Noticing Game: Error in analysis:", error);
          resolve({
            success: false,
            error: error.message || "Unknown error during analysis"
          });
        }
      });
    });
  }

  return {
    analyzeSubtitles
  };
})();
