// Módulo integrador principal para SubtitleProcessor
window.SubtitleProcessor = (function () {
  // Inicialización y comprobación
  function init() {
    console.log("Subtitle Processor initialized");

    // Verificar que todos los módulos necesarios estén disponibles
    if (
      !window.YouTubeVideoUtils ||
      !window.WordDetection ||
      !window.SubtitleExtraction ||
      !window.SubtitleAnalysis
    ) {
      console.error(
        "Some required modules are missing. Functionality may be limited.",
      );
    }
  }

  // Llamar a init en la próxima vuelta del bucle de eventos
  setTimeout(init, 0);

  // Exportar todas las funciones y propiedades necesarias de los módulos
  return {
    // De YouTubeVideoUtils
    getYouTubeVideoId: function () {
      return window.YouTubeVideoUtils.getYouTubeVideoId();
    },
    setupURLChangeListener: function () {
      return window.YouTubeVideoUtils.setupURLChangeListener();
    },

    // De WordDetection
    WORD_VALIDITY_WINDOW: window.WordDetection
      ? window.WordDetection.WORD_VALIDITY_WINDOW
      : 5000,
    recentWords: window.WordDetection ? window.WordDetection.recentWords : {},
    notedWords: window.WordDetection ? window.WordDetection.notedWords : {},
    trackWordAppearance: function (word, timestamp) {
      return window.WordDetection.trackWordAppearance(word, timestamp);
    },
    isWordRecent: function (word) {
      return window.WordDetection.isWordRecent(word);
    },
    markWordAsNoted: function (word) {
      return window.WordDetection.markWordAsNoted(word);
    },
    setupSubtitleObserver: function () {
      return window.WordDetection.setupSubtitleObserver();
    },
    setupHiddenSubtitleDetection: function () {
      return window.WordDetection.setupHiddenSubtitleDetection();
    },

    // De SubtitleExtraction
    preloadSubtitlesWithTimestamps: function () {
      return window.SubtitleExtraction.preloadSubtitlesWithTimestamps();
    },
    getYouTubeSubtitles: function () {
      return window.SubtitleExtraction.getYouTubeSubtitles();
    },

    // De SubtitleAnalysis
    analyzeSubtitles: function () {
      return window.SubtitleAnalysis.analyzeSubtitles();
    },
  };
})();
