// Módulo para rastrear la dificultad de las palabras para el usuario
window.WordDifficultyTracker = (function () {
  // Estructura de datos para rastrear dificultad
  let wordStats = {};
  let dailyStats = {}; // { "YYYY-MM-DD": count }

  // Constantes para el cálculo de dificultad
  const DIFFICULTY_WEIGHTS = {
    CORRECT_CLICK: -1, // Reduce dificultad
    INCORRECT_CLICK: 2, // Aumenta dificultad
    PENALTY_CLICK: 3, // Aumenta más la dificultad
    ALREADY_NOTED: 0.5, // Aumenta ligeramente la dificultad
    TIME_BONUS: -0.5, // Bonus por clics rápidos
    TIME_PENALTY: 1, // Penalización por clics lentos
  };

  // Función para verificar si el contexto de la extensión es válido
  function isExtensionContextValid() {
    try {
      if (!chrome || !chrome.runtime) {
        return false;
      }
      if (!chrome.runtime.id) {
        return false;
      }
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
      "Extension context invalidated in WordDifficultyTracker, cleaning up...",
    );
    wordStats = {};
  }

  // Cargar estadísticas diarias
  function loadDailyStats() {
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        resolve({});
        return;
      }

      // First, let's check what's in sync storage
      chrome.storage.sync.get(["dailyActivityStats"], function (syncResult) {
        const syncError = chrome.runtime.lastError;
        const syncData = syncResult.dailyActivityStats;

        // Also check local storage
        chrome.storage.local.get(["dailyActivityStats"], function (localResult) {
          const localData = localResult.dailyActivityStats;

          // Diagnostic logging
          console.log("=== SYNC DIAGNOSTIC ===");
          console.log("Sync storage error:", syncError ? syncError.message : "none");
          console.log("Sync storage days:", syncData ? Object.keys(syncData).length : 0);
          console.log("Local storage days:", localData ? Object.keys(localData).length : 0);

          // Calculate sizes
          const syncSize = syncData ? JSON.stringify(syncData).length : 0;
          const localSize = localData ? JSON.stringify(localData).length : 0;
          console.log("Sync data size:", syncSize, "bytes (limit: 8192 per item)");
          console.log("Local data size:", localSize, "bytes");
          console.log("=======================");

          // Decision logic: Use sync if available and has data
          if (!syncError && syncData && Object.keys(syncData).length > 0) {
            dailyStats = syncData;
            console.log(`WordDifficultyTracker: Using SYNC data (${Object.keys(dailyStats).length} days)`);
            resolve(dailyStats);
          } else if (localData && Object.keys(localData).length > 0) {
            dailyStats = localData;
            console.log(`WordDifficultyTracker: Using LOCAL data (${Object.keys(dailyStats).length} days)`);

            // Try to migrate to sync (if not too large)
            if (localSize < 8000) { // Leave some margin from 8KB limit
              console.log("WordDifficultyTracker: Migrating daily stats to sync storage...");
              chrome.storage.sync.set({ dailyActivityStats: dailyStats }, function () {
                if (chrome.runtime.lastError) {
                  console.warn("Migration to sync failed:", chrome.runtime.lastError.message);
                } else {
                  console.log("Migration to sync successful!");
                }
              });
            } else {
              console.warn("Daily stats too large for sync storage:", localSize, "bytes. Using local only.");
            }

            resolve(dailyStats);
          } else {
            dailyStats = {};
            console.log("WordDifficultyTracker: No daily stats found in either storage");
            resolve(dailyStats);
          }
        });
      });
    });
  }

  // Cargar estadísticas desde el almacenamiento local
  function loadWordStats() {
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        handleInvalidContext();
        resolve({});
        return;
      }

      try {
        chrome.storage.local.get(["wordDifficultyStats"], function (result) {
          try {
            if (!isExtensionContextValid()) {
              handleInvalidContext();
              resolve({});
              return;
            }

            wordStats = result.wordDifficultyStats || {};
            console.log(
              `WordDifficultyTracker: Loaded stats for ${Object.keys(wordStats).length} words`,
            );
            resolve(wordStats);
          } catch (error) {
            console.error("Error in loadWordStats callback:", error);
            if (
              error.message &&
              error.message.includes("Extension context invalidated")
            ) {
              handleInvalidContext();
            }
            resolve({});
          }
        });
      } catch (error) {
        console.error("Error in loadWordStats:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        resolve({});
      }
    });
  }

  // Guardar estadísticas en el almacenamiento local
  function saveWordStats() {
    if (!isExtensionContextValid()) {
      handleInvalidContext();
      return Promise.reject(new Error("Extension context invalidated"));
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(
          { wordDifficultyStats: wordStats },
          function () {
            try {
              if (!isExtensionContextValid()) {
                handleInvalidContext();
                resolve();
                return;
              }

              console.log(
                `WordDifficultyTracker: Saved stats for ${Object.keys(wordStats).length} words`,
              );
              resolve();
            } catch (error) {
              console.error("Error in saveWordStats callback:", error);
              if (
                error.message &&
                error.message.includes("Extension context invalidated")
              ) {
                handleInvalidContext();
              }
              resolve();
            }
          },
        );
      } catch (error) {
        console.error("Error in saveWordStats:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        resolve();
      }
    });
  }

  // Guardar estadísticas diarias
  function saveDailyStats() {
    if (!isExtensionContextValid()) return Promise.resolve();
    return new Promise((resolve) => {
      // Save to both Sync and Local for redundancy
      const data = { dailyActivityStats: dailyStats };
      chrome.storage.sync.set(data, function () {
        if (chrome.runtime.lastError) console.warn("Error saving daily stats to sync:", chrome.runtime.lastError);
      });

      chrome.storage.local.set(data, function () {
        if (chrome.runtime.lastError) {
          console.error("Error saving daily stats to local:", chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  // Inicializar estadísticas para una palabra si no existe
  function initializeWordStats(word) {
    if (!wordStats[word]) {
      wordStats[word] = {
        totalClicks: 0,
        correctClicks: 0,
        incorrectClicks: 0,
        penaltyClicks: 0,
        alreadyNotedClicks: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        difficultyScore: 0,
        lastSeen: Date.now(),
        firstSeen: Date.now(),
      };
    }
    return wordStats[word];
  }

  // Registrar un clic en una palabra
  function recordWordClick(word, clickType, responseTime = null) {
    if (!word || typeof word !== "string") {
      console.warn("Invalid word provided to recordWordClick:", word);
      return;
    }

    word = word.toLowerCase().trim();
    const stats = initializeWordStats(word);

    // Actualizar contadores
    stats.totalClicks++;
    stats.lastSeen = Date.now();

    switch (clickType) {
      case "correct":
        stats.correctClicks++;
        recordDailyActivity(); // Track activity for heatmap
        break;
      case "incorrect":
        stats.incorrectClicks++;
        break;
      case "penalty":
        stats.penaltyClicks++;
        break;
      case "already_noted":
        stats.alreadyNotedClicks++;
        break;
    }

    // Actualizar tiempo de respuesta si se proporciona
    if (
      responseTime !== null &&
      typeof responseTime === "number" &&
      responseTime > 0
    ) {
      stats.totalResponseTime += responseTime;
      stats.averageResponseTime = stats.totalResponseTime / stats.correctClicks;
    }

    // Recalcular puntuación de dificultad
    calculateDifficultyScore(word);

    // Guardar cambios
    saveWordStats().catch((error) => {
      console.error("Error saving word stats:", error);
    });

    console.log(
      `WordDifficultyTracker: Recorded ${clickType} click for "${word}", difficulty: ${stats.difficultyScore.toFixed(2)}`,
    );
  }

  // Calcular la puntuación de dificultad para una palabra
  function calculateDifficultyScore(word) {
    const stats = wordStats[word];
    if (!stats) return 0;

    let score = 0;

    // Puntuación base basada en tipos de clics
    score += stats.correctClicks * DIFFICULTY_WEIGHTS.CORRECT_CLICK;
    score += stats.incorrectClicks * DIFFICULTY_WEIGHTS.INCORRECT_CLICK;
    score += stats.penaltyClicks * DIFFICULTY_WEIGHTS.PENALTY_CLICK;
    score += stats.alreadyNotedClicks * DIFFICULTY_WEIGHTS.ALREADY_NOTED;

    // Factor de tiempo de respuesta (solo si hay clics correctos)
    if (stats.correctClicks > 0 && stats.averageResponseTime > 0) {
      // Penalizar tiempos de respuesta lentos (>3 segundos)
      if (stats.averageResponseTime > 3000) {
        score += DIFFICULTY_WEIGHTS.TIME_PENALTY;
      }
      // Bonificar tiempos de respuesta rápidos (<1 segundo)
      else if (stats.averageResponseTime < 1000) {
        score += DIFFICULTY_WEIGHTS.TIME_BONUS;
      }
    }

    // Factor de frecuencia de errores
    if (stats.totalClicks > 0) {
      const errorRate =
        (stats.incorrectClicks + stats.penaltyClicks) / stats.totalClicks;
      score += errorRate * 2; // Aumentar dificultad basado en tasa de errores
    }

    // Normalizar la puntuación (mínimo 0)
    score = Math.max(0, score);

    stats.difficultyScore = score;
    return score;
  }

  // Obtener palabras ordenadas por dificultad
  // Modificado: difíciles (historial y dificultad alta), luego nunca vistas (sin historial, ordenadas por aparición), luego fáciles (historial y dificultad baja)
  function getWordsByDifficulty(wordList, easyThreshold = 2) {
    const wordsWithDifficulty = [];

    wordList.forEach((wordInfo) => {
      const word = wordInfo.word.toLowerCase();
      const stats = wordStats[word];

      let difficultyScore = 0;
      let hasHistory = false;

      if (stats) {
        difficultyScore = stats.difficultyScore;
        hasHistory = stats.totalClicks > 0;
      }

      wordsWithDifficulty.push({
        ...wordInfo,
        difficultyScore: difficultyScore,
        hasHistory: hasHistory,
        stats: stats || null,
      });
    });

    // Separar palabras en tres grupos
    const difficult = wordsWithDifficulty.filter(
      (w) => w.hasHistory && w.difficultyScore > easyThreshold,
    );
    const unseen = wordsWithDifficulty.filter((w) => !w.hasHistory);
    const easy = wordsWithDifficulty.filter(
      (w) => w.hasHistory && w.difficultyScore <= easyThreshold,
    );

    // Ordenar difíciles de mayor a menor dificultad
    difficult.sort((a, b) => b.difficultyScore - a.difficultyScore);

    // Ordenar nunca vistas por orden de aparición si existe el módulo WordSortingModes
    let sortedUnseen = unseen;
    if (
      window.WordSortingModes &&
      typeof window.WordSortingModes.sortByAppearanceOrder === "function"
    ) {
      sortedUnseen = window.WordSortingModes.sortByAppearanceOrder(unseen);
    }

    // Ordenar fáciles de menor a mayor dificultad
    easy.sort((a, b) => a.difficultyScore - b.difficultyScore);

    const result = [...difficult, ...sortedUnseen, ...easy];

    console.log(
      `WordDifficultyTracker: Sorted ${result.length} words by difficulty (difíciles, nunca vistas, fáciles)`,
    );
    return result;
  }

  // Obtener estadísticas de una palabra específica
  function getWordStats(word) {
    if (!word || typeof word !== "string") {
      return null;
    }

    word = word.toLowerCase().trim();
    return wordStats[word] || null;
  }

  // Obtener estadísticas generales
  function getGeneralStats() {
    const totalWords = Object.keys(wordStats).length;
    let totalClicks = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalPenalty = 0;
    let averageDifficulty = 0;

    Object.values(wordStats).forEach((stats) => {
      totalClicks += stats.totalClicks;
      totalCorrect += stats.correctClicks;
      totalIncorrect += stats.incorrectClicks;
      totalPenalty += stats.penaltyClicks;
      averageDifficulty += stats.difficultyScore;
    });

    if (totalWords > 0) {
      averageDifficulty /= totalWords;
    }

    return {
      totalWords,
      totalClicks,
      totalCorrect,
      totalIncorrect,
      totalPenalty,
      averageDifficulty,
      accuracy: totalClicks > 0 ? (totalCorrect / totalClicks) * 100 : 0,
    };
  }

  // Limpiar datos antiguos (palabras no vistas en más de 30 días)
  // Ahora NO elimina palabras aprendidas nunca.
  function cleanupOldData() {
    // No hacer nada: el registro de palabras aprendidas no se borra nunca.
    // Esta función se mantiene para compatibilidad, pero no elimina datos.
    return;
  }

  // Resetear estadísticas de una palabra específica
  function resetWordStats(word) {
    if (!word || typeof word !== "string") {
      return false;
    }

    word = word.toLowerCase().trim();
    if (wordStats[word]) {
      delete wordStats[word];
      saveWordStats().catch((error) => {
        console.error("Error saving after reset:", error);
      });
      console.log(`WordDifficultyTracker: Reset stats for "${word}"`);
      return true;
    }
    return false;
  }

  // Resetear todas las estadísticas
  function resetAllStats() {
    wordStats = {};
    saveWordStats().catch((error) => {
      console.error("Error saving after full reset:", error);
    });
    console.log("WordDifficultyTracker: Reset all word statistics");
  }

  // Exportar estadísticas para respaldo
  function exportStats() {
    return {
      wordStats: wordStats,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };
  }

  // Importar estadísticas desde respaldo
  function importStats(data) {
    try {
      if (data && data.wordStats && typeof data.wordStats === "object") {
        wordStats = data.wordStats;
        saveWordStats().catch((error) => {
          console.error("Error saving imported stats:", error);
        });
        console.log(
          `WordDifficultyTracker: Imported stats for ${Object.keys(wordStats).length} words`,
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error importing stats:", error);
      return false;
    }
  }

  // Inicializar el módulo
  function initialize() {
    Promise.all([loadWordStats(), loadDailyStats()])
      .then(() => {
        // cleanupOldData(); // Ya no se eliminan palabras aprendidas nunca
      })
      .catch((error) => {
        console.error("Error initializing WordDifficultyTracker:", error);
      });
  }

  // Inicializar automáticamente
  setTimeout(initialize, 100);

  // Obtener palabras aprendidas (con al menos un clic correcto)
  function getLearnedWords() {
    // Devuelve un array de objetos { word, stats, difficultyScore }
    return Object.entries(wordStats)
      .filter(([word, stats]) => stats.correctClicks > 0)
      .map(([word, stats]) => ({
        word,
        stats,
        difficultyScore: stats.difficultyScore,
      }));
  }

  // Obtener palabras no notadas (mostradas pero nunca clickeadas correctamente)
  function getUnnotedWords() {
    // Devuelve un array de objetos { word, stats, difficultyScore }
    return Object.entries(wordStats)
      .filter(
        ([word, stats]) => stats.totalClicks > 0 && stats.correctClicks === 0,
      )
      .map(([word, stats]) => ({
        word,
        stats,
        difficultyScore: stats.difficultyScore,
      }));
  }

  // Actualizar dificultades de palabras en lote (para importación desde Anki)
  function updateWordDifficulties(updates) {
    if (!updates || !Array.isArray(updates)) return Promise.resolve();

    let count = 0;
    updates.forEach((item) => {
      if (!item.word) return;
      const word = item.word.toLowerCase().trim();
      const stats = initializeWordStats(word);

      // Si se proporciona una puntuación, actualizarla
      if (typeof item.difficultyScore === 'number') {
        stats.difficultyScore = Math.max(0, Math.min(10, item.difficultyScore));
        // Marcar como "vista" si tiene dificultad asignada
        if (stats.totalClicks === 0) {
          stats.totalClicks = 1; // Fake click history to make it show up in "By Difficulty" sorting
          stats.lastSeen = Date.now();
        }
        count++;
      }
    });

    return saveWordStats().then(() => {
      console.log(`WordDifficultyTracker: Updated difficulty for ${count} words`);
    });
  }

  // Obtener todas las palabras (notadas, no notadas y sin intentos)
  function getAllWords() {
    return Object.entries(wordStats).map(([word, stats]) => ({
      word,
      stats,
      difficultyScore: stats.difficultyScore,
      hasHistory: stats.totalClicks > 0,
      isNoted: stats.correctClicks > 0,
      isUnnoticed: stats.totalClicks > 0 && stats.correctClicks === 0,
    }));
  }

  // Obtener estadísticas para el modal de palabras
  function getModalStats() {
    const learnedWords = getLearnedWords();
    const unnotedWords = getUnnotedWords();
    const totalWords = Object.keys(wordStats).length;

    return {
      totalNoted: learnedWords.length,
      totalUnnoted: unnotedWords.length,
      totalShown: totalWords,
      avgDifficulty:
        learnedWords.length > 0
          ? learnedWords.reduce((a, b) => a + (b.difficultyScore || 0), 0) /
          learnedWords.length
          : 0,
      hardestWord:
        learnedWords.length > 0
          ? learnedWords.reduce((a, b) =>
            (b.difficultyScore || 0) > (a.difficultyScore || 0) ? b : a,
          ).word
          : null,
      easiestWord:
        learnedWords.length > 0
          ? learnedWords.reduce((a, b) =>
            (b.difficultyScore || 0) < (a.difficultyScore || 0) ? b : a,
          ).word
          : null,
    };
  }

  // Registrar actividad diaria (heatmap)
  function recordDailyActivity() {
    // Usar fecha local para evitar problemas de zona horaria
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    if (!dailyStats[today]) {
      dailyStats[today] = 0;
    }
    dailyStats[today]++;
    saveDailyStats();
  }

  // Obtener estadísticas diarias para el heatmap
  function getDailyStats() {
    return dailyStats;
  }

  // Exportar API pública
  return {
    recordWordClick,
    getWordsByDifficulty,
    getWordStats,
    getGeneralStats,
    resetWordStats,
    resetAllStats,
    exportStats,
    importStats,
    loadWordStats,
    saveWordStats,
    cleanupOldData,
    getLearnedWords,
    getUnnotedWords,
    getModalStats,
    getAllWords,
    updateWordDifficulties,
    recordDailyActivity,
    getDailyStats,
  };
})();
