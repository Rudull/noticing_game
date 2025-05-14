// Utilidades para interactuar con videos de YouTube
window.YouTubeVideoUtils = (function () {
  // Función para obtener el ID del video actual
  function getYouTubeVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }

  // Función para detectar cambios de URL (cambios de video)
  function setupURLChangeListener() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const newVideoId = getYouTubeVideoId();
        console.log(`Noticing Game: URL changed, new video ID: ${newVideoId}`);

        if (newVideoId !== window.currentVideoId) {
          window.currentVideoId = newVideoId;
          if (window.UIManager && window.UIManager.clearWordList) {
            window.UIManager.clearWordList();
          }

          // Reiniciar observadores de subtítulos
          if (window.noticingGameSubtitleInterval) {
            clearInterval(window.noticingGameSubtitleInterval);
          }

          if (window.noticingGameHiddenSubtitleInterval) {
            clearInterval(window.noticingGameHiddenSubtitleInterval);
          }

          // Reinicializar según el estado de subtítulos
          const ccButton = document.querySelector(".ytp-subtitles-button");
          const subtitlesVisible =
            ccButton && ccButton.getAttribute("aria-pressed") === "true";

          // Usar las funciones del gestor de palabras
          if (window.WordDetection) {
            if (subtitlesVisible) {
              window.WordDetection.setupSubtitleObserver();
            } else {
              window.WordDetection.setupHiddenSubtitleDetection();
            }

            // Limpiar palabras recientes
            Object.keys(window.WordDetection.recentWords).forEach(
              (key) => delete window.WordDetection.recentWords[key],
            );
          }

          console.log(
            "Noticing Game: Successfully reinitialized after URL change",
          );
        }
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }

  return {
    getYouTubeVideoId,
    setupURLChangeListener,
  };
})();
