// Módulo para gestionar los diferentes modos de ordenamiento de palabras
window.WordSortingModes = (function () {
  // Modos de ordenamiento disponibles
  const SORTING_MODES = {
    FREQUENCY: "frequency",
    APPEARANCE_ORDER: "appearance_order",
    DIFFICULTY: "difficulty",
    RANDOM: "random",
  };

  // Configuración actual
  let currentMode = SORTING_MODES.FREQUENCY;
  let wordAppearanceOrder = new Map(); // Para rastrear orden de aparición

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
      "Extension context invalidated in WordSortingModes, cleaning up...",
    );
    wordAppearanceOrder.clear();
    currentMode = SORTING_MODES.FREQUENCY;
  }

  // Cargar configuración del modo desde el almacenamiento
  function loadSortingMode() {
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        handleInvalidContext();
        resolve(SORTING_MODES.FREQUENCY);
        return;
      }

      try {
        chrome.storage.local.get(["wordSortingMode"], function (result) {
          try {
            if (!isExtensionContextValid()) {
              handleInvalidContext();
              resolve(SORTING_MODES.FREQUENCY);
              return;
            }

            currentMode = result.wordSortingMode || SORTING_MODES.FREQUENCY;
            console.log(
              `WordSortingModes: Loaded sorting mode: ${currentMode}`,
            );
            resolve(currentMode);
          } catch (error) {
            console.error("Error in loadSortingMode callback:", error);
            if (
              error.message &&
              error.message.includes("Extension context invalidated")
            ) {
              handleInvalidContext();
            }
            resolve(SORTING_MODES.FREQUENCY);
          }
        });
      } catch (error) {
        console.error("Error in loadSortingMode:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        resolve(SORTING_MODES.FREQUENCY);
      }
    });
  }

  // Guardar configuración del modo en el almacenamiento
  function saveSortingMode(mode) {
    if (!isExtensionContextValid()) {
      handleInvalidContext();
      return Promise.reject(new Error("Extension context invalidated"));
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ wordSortingMode: mode }, function () {
          try {
            if (!isExtensionContextValid()) {
              handleInvalidContext();
              resolve();
              return;
            }

            currentMode = mode;
            console.log(`WordSortingModes: Saved sorting mode: ${mode}`);
            resolve();
          } catch (error) {
            console.error("Error in saveSortingMode callback:", error);
            if (
              error.message &&
              error.message.includes("Extension context invalidated")
            ) {
              handleInvalidContext();
            }
            resolve();
          }
        });
      } catch (error) {
        console.error("Error in saveSortingMode:", error);
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

  // Registrar la aparición de una palabra en el video (para orden de aparición)
  function recordWordAppearance(word, timestamp = Date.now()) {
    if (!word || typeof word !== "string") {
      return;
    }

    word = word.toLowerCase().trim();

    // Solo registrar la primera aparición de cada palabra
    if (!wordAppearanceOrder.has(word)) {
      wordAppearanceOrder.set(word, timestamp);
      console.log(
        `WordSortingModes: Recorded first appearance of "${word}" at ${timestamp}`,
      );
    }
  }

  // Limpiar el registro de apariciones (al cambiar de video)
  function clearAppearanceOrder() {
    wordAppearanceOrder.clear();
    console.log("WordSortingModes: Cleared appearance order");
  }

  // Ordenar palabras por frecuencia (modo por defecto)
  function sortByFrequency(words) {
    return [...words].sort((a, b) => {
      // Ordenar por frecuencia descendente
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Si tienen la misma frecuencia, ordenar alfabéticamente
      return a.word.localeCompare(b.word);
    });
  }

  // Ordenar palabras por orden de aparición
  function sortByAppearanceOrder(words) {
    return [...words].sort((a, b) => {
      const wordA = a.word.toLowerCase();
      const wordB = b.word.toLowerCase();

      const timestampA = wordAppearanceOrder.get(wordA) || Infinity;
      const timestampB = wordAppearanceOrder.get(wordB) || Infinity;

      // Ordenar por timestamp ascendente (primeras apariciones primero)
      if (timestampA !== timestampB) {
        return timestampA - timestampB;
      }

      // Si no hay timestamp registrado para ninguna, ordenar por frecuencia
      if (timestampA === Infinity && timestampB === Infinity) {
        return b.count - a.count;
      }

      // Como fallback, ordenar alfabéticamente
      return wordA.localeCompare(wordB);
    });
  }

  // Ordenar palabras por dificultad
  function sortByDifficulty(words) {
    if (!window.WordDifficultyTracker) {
      console.warn(
        "WordDifficultyTracker not available, falling back to frequency sorting",
      );
      return sortByFrequency(words);
    }

    // Usar el método del tracker de dificultad con la nueva lógica:
    // difíciles (historial y dificultad alta), luego nunca vistas (sin historial, ordenadas por aparición), luego fáciles (historial y dificultad baja)
    // El threshold de fácil debe coincidir con el de getWordsByDifficulty (por defecto 2)
    const easyThreshold = 2;
    const sortedWords = window.WordDifficultyTracker.getWordsByDifficulty(
      words,
      easyThreshold,
    );

    // Separar en difíciles, nunca vistas y fáciles según la lógica de getWordsByDifficulty
    const difficult = sortedWords.filter(
      (w) => w.hasHistory && w.difficultyScore > easyThreshold,
    );
    const unseen = sortedWords.filter((w) => !w.hasHistory);
    const easy = sortedWords.filter(
      (w) => w.hasHistory && w.difficultyScore <= easyThreshold,
    );

    // Ya están ordenados internamente en getWordsByDifficulty, pero por claridad:
    return [...difficult, ...unseen, ...easy];
  }

  // Ordenar palabras aleatoriamente
  function sortRandomly(words) {
    const shuffled = [...words];

    // Algoritmo Fisher-Yates para barajado aleatorio
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    console.log("WordSortingModes: Words shuffled randomly");
    return shuffled;
  }

  // Función principal para ordenar palabras según el modo actual
  function sortWords(words, mode = null) {
    if (!words || !Array.isArray(words) || words.length === 0) {
      return [];
    }

    const sortingMode = mode || currentMode;

    console.log(
      `WordSortingModes: Sorting ${words.length} words using mode: ${sortingMode}`,
    );

    switch (sortingMode) {
      case SORTING_MODES.FREQUENCY:
        return sortByFrequency(words);

      case SORTING_MODES.APPEARANCE_ORDER:
        return sortByAppearanceOrder(words);

      case SORTING_MODES.DIFFICULTY:
        return sortByDifficulty(words);

      case SORTING_MODES.RANDOM:
        return sortRandomly(words);

      default:
        console.warn(`Unknown sorting mode: ${sortingMode}, using frequency`);
        return sortByFrequency(words);
    }
  }

  // Cambiar el modo de ordenamiento
  function setSortingMode(mode) {
    if (!Object.values(SORTING_MODES).includes(mode)) {
      console.error(`Invalid sorting mode: ${mode}`);
      return false;
    }

    const oldMode = currentMode;
    currentMode = mode;

    // Guardar la configuración
    saveSortingMode(mode).catch((error) => {
      console.error("Error saving sorting mode:", error);
      // Revertir al modo anterior en caso de error
      currentMode = oldMode;
    });

    console.log(
      `WordSortingModes: Changed sorting mode from ${oldMode} to ${mode}`,
    );
    return true;
  }

  // Obtener el modo actual
  function getCurrentMode() {
    return currentMode;
  }

  // Obtener la lista de modos disponibles
  function getAvailableModes() {
    return {
      [SORTING_MODES.FREQUENCY]: {
        id: SORTING_MODES.FREQUENCY,
        name: "By Frequency",
        description:
          "Sort words by how often they appear in the video (most frequent first)",
      },
      [SORTING_MODES.APPEARANCE_ORDER]: {
        id: SORTING_MODES.APPEARANCE_ORDER,
        name: "By Appearance Order",
        description:
          "Sort words by when they first appear in the video (earliest first)",
      },
      [SORTING_MODES.DIFFICULTY]: {
        id: SORTING_MODES.DIFFICULTY,
        name: "By Difficulty",
        description:
          "Sort words by your personal difficulty (hardest to notice first)",
      },
      [SORTING_MODES.RANDOM]: {
        id: SORTING_MODES.RANDOM,
        name: "Random",
        description: "Show words in random order for varied practice",
      },
    };
  }

  // Obtener información del modo actual
  function getCurrentModeInfo() {
    const modes = getAvailableModes();
    return modes[currentMode] || modes[SORTING_MODES.FREQUENCY];
  }

  // Obtener estadísticas del ordenamiento
  function getSortingStats() {
    return {
      currentMode: currentMode,
      wordsWithAppearanceData: wordAppearanceOrder.size,
      hasDifficultyTracker: !!window.WordDifficultyTracker,
      difficultyStats: window.WordDifficultyTracker
        ? window.WordDifficultyTracker.getGeneralStats()
        : null,
    };
  }

  // Resetear datos de ordenamiento
  function resetSortingData() {
    clearAppearanceOrder();

    // También resetear datos de dificultad si está disponible
    if (
      window.WordDifficultyTracker &&
      typeof window.WordDifficultyTracker.resetAllStats === "function"
    ) {
      window.WordDifficultyTracker.resetAllStats();
    }

    console.log("WordSortingModes: Reset all sorting data");
  }

  // Crear opciones para el selector HTML
  function createModeOptions() {
    const modes = getAvailableModes();
    let options = "";

    Object.values(modes).forEach((mode) => {
      const selected = mode.id === currentMode ? "selected" : "";
      options += `<option value="${mode.id}" ${selected} title="${mode.description}">${mode.name}</option>`;
    });

    return options;
  }

  // Manejar el cambio de modo desde el UI
  function handleModeChange(newMode, callback) {
    if (setSortingMode(newMode)) {
      if (callback && typeof callback === "function") {
        callback({
          success: true,
          mode: newMode,
          modeInfo: getCurrentModeInfo(),
        });
      }
    } else {
      if (callback && typeof callback === "function") {
        callback({
          success: false,
          error: "Invalid sorting mode",
        });
      }
    }
  }

  // Integración con el sistema de detección de palabras
  function integrateWithWordDetection() {
    // Escuchar eventos de detección de palabras para el orden de aparición
    if (
      window.WordDetection &&
      typeof window.WordDetection.trackWordAppearance === "function"
    ) {
      const originalTrackWordAppearance =
        window.WordDetection.trackWordAppearance;

      window.WordDetection.trackWordAppearance = function (word, timestamp) {
        // Llamar a la función original
        const result = originalTrackWordAppearance.call(this, word, timestamp);

        // Registrar para orden de aparición
        recordWordAppearance(word, timestamp);

        return result;
      };

      console.log(
        "WordSortingModes: Integrated with WordDetection for appearance tracking",
      );
    }
  }

  // Inicializar el módulo
  function initialize() {
    loadSortingMode()
      .then((mode) => {
        console.log(`WordSortingModes: Initialized with mode: ${mode}`);

        // Integrar con el sistema de detección
        integrateWithWordDetection();
      })
      .catch((error) => {
        console.error("Error initializing WordSortingModes:", error);
      });
  }

  // Inicializar automáticamente
  setTimeout(initialize, 150);

  // Exportar API pública
  return {
    // Constantes
    MODES: SORTING_MODES,

    // Funciones principales
    sortWords,
    setSortingMode,
    getCurrentMode,
    getCurrentModeInfo,
    getAvailableModes,

    // Gestión de apariciones
    recordWordAppearance,
    clearAppearanceOrder,

    // UI helpers
    createModeOptions,
    handleModeChange,

    // Estadísticas y utilidades
    getSortingStats,
    resetSortingData,

    // Configuración
    loadSortingMode,
    saveSortingMode,
  };
})();
