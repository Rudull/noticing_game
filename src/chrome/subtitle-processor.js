// Módulo integrador principal para SubtitleProcessor
window.SubtitleProcessor = (function () {
  let isInitialized = false;

  // Inicialización y comprobación
  function init() {
    console.log("Subtitle Processor initializing...");

    // Verificar que todos los módulos necesarios estén disponibles
    const requiredModules = [
      "YouTubeVideoUtils",
      "WordDetection",
      "SubtitleExtraction",
      "SubtitleAnalysis",
    ];

    const missingModules = requiredModules.filter((module) => !window[module]);

    if (missingModules.length > 0) {
      console.warn(
        "Subtitle Processor: Missing modules:",
        missingModules.join(", "),
        "- Retrying in 500ms",
      );

      // Reintentar después de un breve delay
      setTimeout(init, 500);
      return;
    }

    isInitialized = true;
    console.log("Subtitle Processor: All modules loaded successfully");
  }

  // Función para verificar si un módulo está disponible
  function checkModule(moduleName, functionName = null) {
    if (!window[moduleName]) {
      console.error(`Module ${moduleName} not available`);
      return false;
    }

    if (
      functionName &&
      typeof window[moduleName][functionName] !== "function"
    ) {
      console.error(
        `Function ${functionName} not available in module ${moduleName}`,
      );
      return false;
    }

    return true;
  }

  // Llamar a init en la próxima vuelta del bucle de eventos
  setTimeout(init, 100);

  // Exportar todas las funciones y propiedades necesarias de los módulos
  return {
    // Estado del procesador
    isInitialized: function () {
      return isInitialized;
    },

    // De YouTubeVideoUtils
    getYouTubeVideoId: function () {
      if (!checkModule("YouTubeVideoUtils", "getYouTubeVideoId")) {
        return null;
      }
      try {
        return window.YouTubeVideoUtils.getYouTubeVideoId();
      } catch (error) {
        console.error("Error getting video ID:", error);
        return null;
      }
    },
    setupURLChangeListener: function () {
      if (!checkModule("YouTubeVideoUtils", "setupURLChangeListener")) {
        return false;
      }
      try {
        return window.YouTubeVideoUtils.setupURLChangeListener();
      } catch (error) {
        console.error("Error setting up URL change listener:", error);
        return false;
      }
    },

    // De WordDetection
    WORD_VALIDITY_WINDOW: function () {
      return window.WordDetection
        ? window.WordDetection.WORD_VALIDITY_WINDOW
        : 5000;
    },
    recentWords: function () {
      return window.WordDetection ? window.WordDetection.recentWords : {};
    },
    notedWords: function () {
      return window.WordDetection ? window.WordDetection.notedWords : {};
    },
    trackWordAppearance: function (word, timestamp) {
      if (!checkModule("WordDetection", "trackWordAppearance")) {
        return false;
      }
      try {
        const result = window.WordDetection.trackWordAppearance(
          word,
          timestamp,
        );

        // También registrar en el sistema de ordenamiento por aparición
        if (
          window.WordSortingModes &&
          typeof window.WordSortingModes.recordWordAppearance === "function"
        ) {
          window.WordSortingModes.recordWordAppearance(word, timestamp);
        }

        return result;
      } catch (error) {
        console.error("Error tracking word appearance:", error);
        return false;
      }
    },
    isWordRecent: function (word) {
      if (!checkModule("WordDetection", "isWordRecent")) {
        return { isRecent: false, timeDiff: null, alreadyNoted: false };
      }
      try {
        return window.WordDetection.isWordRecent(word);
      } catch (error) {
        console.error("Error checking if word is recent:", error);
        return { isRecent: false, timeDiff: null, alreadyNoted: false };
      }
    },
    markWordAsNoted: function (word) {
      if (!checkModule("WordDetection", "markWordAsNoted")) {
        return false;
      }
      try {
        return window.WordDetection.markWordAsNoted(word);
      } catch (error) {
        console.error("Error marking word as noted:", error);
        return false;
      }
    },
    setupSubtitleObserver: function () {
      if (!checkModule("WordDetection", "setupSubtitleObserver")) {
        return false;
      }
      try {
        return window.WordDetection.setupSubtitleObserver();
      } catch (error) {
        console.error("Error setting up subtitle observer:", error);
        return false;
      }
    },
    setupHiddenSubtitleDetection: function () {
      if (!checkModule("WordDetection", "setupHiddenSubtitleDetection")) {
        return false;
      }
      try {
        return window.WordDetection.setupHiddenSubtitleDetection();
      } catch (error) {
        console.error("Error setting up hidden subtitle detection:", error);
        return false;
      }
    },

    // De SubtitleExtraction
    preloadSubtitlesWithTimestamps: function () {
      if (
        !checkModule("SubtitleExtraction", "preloadSubtitlesWithTimestamps")
      ) {
        return Promise.reject(
          new Error("SubtitleExtraction module not available"),
        );
      }
      try {
        return window.SubtitleExtraction.preloadSubtitlesWithTimestamps();
      } catch (error) {
        console.error("Error preloading subtitles with timestamps:", error);
        return Promise.reject(error);
      }
    },
    getYouTubeSubtitles: function () {
      if (!checkModule("SubtitleExtraction", "getYouTubeSubtitles")) {
        return Promise.reject(
          new Error("SubtitleExtraction module not available"),
        );
      }
      try {
        return window.SubtitleExtraction.getYouTubeSubtitles();
      } catch (error) {
        console.error("Error getting YouTube subtitles:", error);
        return Promise.reject(error);
      }
    },

    // De SubtitleAnalysis
    analyzeSubtitles: function () {
      if (!checkModule("SubtitleAnalysis", "analyzeSubtitles")) {
        return Promise.reject(
          new Error("SubtitleAnalysis module not available"),
        );
      }
      try {
        return window.SubtitleAnalysis.analyzeSubtitles();
      } catch (error) {
        console.error("Error analyzing subtitles:", error);
        return Promise.reject(error);
      }
    },
  };
})();
