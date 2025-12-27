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
                // La URL ha cambiado
                const oldUrl = lastUrl;
                lastUrl = location.href;
                const newVideoId = getYouTubeVideoId();

                // Solo recargamos si estamos en una página de video y la URL anterior también era una página de video
                if (newVideoId && oldUrl.includes("youtube.com/watch")) {
                    console.log(
                        "Noticing Game: URL changed to new video, reloading page...",
                    );

                    // Comprobar si el panel está visible actualmente
                    const panel = document.querySelector(
                        ".noticing-game-panel",
                    );
                    const isPanelVisible =
                        panel && panel.style.display !== "none";

                    // Guardar el estado de visibilidad en localStorage
                    localStorage.setItem(
                        "noticing_game_panel_open",
                        isPanelVisible ? "true" : "false",
                    );

                    // Forzar recarga de la página
                    window.location.reload();
                    return; // No continuamos con el código ya que la página se recargará
                }

                console.log(
                    `Noticing Game: URL changed, new video ID: ${newVideoId}`,
                );

                if (newVideoId !== window.currentVideoId) {
                    window.currentVideoId = newVideoId;

                    console.log("Noticing Game: Resetting state for new video");

                    // Resetear análisis previo
                    window.lastAnalyzedVideoId = null;

                    // Limpiar UI
                    if (window.UIManager) {
                        window.UIManager.clearWordList();

                        // Obtener el panel si existe y limpiarlo completamente
                        const panel = document.querySelector(
                            ".noticing-game-panel",
                        );
                        if (panel) {
                            const wordList = panel.querySelector(
                                ".noticing-game-list",
                            );
                            if (wordList) wordList.innerHTML = "";

                            const status = panel.querySelector(
                                ".noticing-game-status",
                            );
                            if (status)
                                status.textContent =
                                    'Click "Play" to detect frequent words.';
                        }
                    }

                    // Reiniciar observadores de subtítulos
                    if (window.noticingGameSubtitleInterval) {
                        clearInterval(window.noticingGameSubtitleInterval);
                    }

                    if (window.noticingGameHiddenSubtitleInterval) {
                        clearInterval(
                            window.noticingGameHiddenSubtitleInterval,
                        );
                    }

                    // Reinicializar según el estado de subtítulos
                    const ccButton = document.querySelector(
                        ".ytp-subtitles-button",
                    );
                    const subtitlesVisible =
                        ccButton &&
                        ccButton.getAttribute("aria-pressed") === "true";

                    // Reiniciar estado de detección de palabras
                    if (window.WordDetection) {
                        if (subtitlesVisible) {
                            window.WordDetection.setupSubtitleObserver();
                        } else {
                            window.WordDetection.setupHiddenSubtitleDetection();
                        }

                        // Limpiar palabras recientes y notadas
                        Object.keys(window.WordDetection.recentWords).forEach(
                            (key) =>
                                delete window.WordDetection.recentWords[key],
                        );

                        Object.keys(window.WordDetection.notedWords).forEach(
                            (key) =>
                                delete window.WordDetection.notedWords[key],
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
