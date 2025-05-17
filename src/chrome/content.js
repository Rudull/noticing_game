// Main script injected into YouTube page
console.log("Noticing Game: Content script loaded");

// Verificar que el puente de comunicación esté disponible
if (!window.postMessageOriginal) {
    // Guardar referencia al original por si acaso
    window.postMessageOriginal = window.postMessage;
}

// Use the SubtitleProcessor module
const SP = window.SubtitleProcessor;
let currentVideoId = SP.getYouTubeVideoId();
let subtitleObserverInterval = null;
let isInitialized = false;

// Initialize when page loads
window.addEventListener("load", () => {
    console.log("Noticing Game: Page loaded, initializing...");
    initializeExtension();

    // Verificar si debemos mostrar el panel automáticamente después de una recarga
    // Esperamos un poco para asegurar que todo se haya inicializado correctamente
    setTimeout(() => {
        const shouldShowPanel =
            localStorage.getItem("noticing_game_panel_open") === "true";

        if (shouldShowPanel) {
            console.log("Noticing Game: Auto-showing panel after reload");
            // Limpiar el flag para que no se abra en futuras cargas normales
            localStorage.removeItem("noticing_game_panel_open");

            // Mostrar el panel
            showFloatingPanel();
        }
    }, 1500); // Esperamos 1.5 segundos para asegurar inicialización completa
});

// Function to initialize or reinitialize the extension
function initializeExtension() {
    if (
        window.UIManager &&
        typeof window.UIManager.waitForYouTubeControls === "function"
    ) {
        window.UIManager.waitForYouTubeControls();
        SP.setupURLChangeListener();

        // Reset analysis state when initializing for a new video
        window.lastAnalyzedVideoId = null;

        // Clear any WordDetection state
        if (window.WordDetection) {
            Object.keys(window.WordDetection.recentWords || {}).forEach(
                (key) => delete window.WordDetection.recentWords[key],
            );
            Object.keys(window.WordDetection.notedWords || {}).forEach(
                (key) => delete window.WordDetection.notedWords[key],
            );
        }

        // Clear any previous word lists and game state
        const panel = document.querySelector(".noticing-game-panel");
        if (panel) {
            const wordList = panel.querySelector(".noticing-game-list");
            if (wordList) wordList.innerHTML = "";

            const status = panel.querySelector(".noticing-game-status");
            if (status)
                status.textContent = 'Click "Play" to detect frequent words.';
        }

        // Verificar si los subtítulos están visibles
        const ccButton = document.querySelector(".ytp-subtitles-button");
        const subtitlesVisible =
            ccButton && ccButton.getAttribute("aria-pressed") === "true";

        if (subtitlesVisible) {
            // Usar el método existente si hay subtítulos visibles
            SP.setupSubtitleObserver();
            console.log(
                "Noticing Game: Initialized with visible subtitles mode",
            );
        } else {
            // Usar el nuevo método para detección sin subtítulos visibles
            if (typeof SP.setupHiddenSubtitleDetection === "function") {
                SP.setupHiddenSubtitleDetection();
                console.log(
                    "Noticing Game: Initialized with hidden subtitles detection",
                );
            } else {
                console.warn(
                    "Noticing Game: Hidden subtitle detection not available, falling back to normal mode",
                );
                SP.setupSubtitleObserver();
            }
        }

        isInitialized = true;
        console.log("Noticing Game: Successfully initialized");
    } else {
        console.error(
            "Noticing Game: function waitForYouTubeControls not available, retrying in 2 seconds",
        );
        setTimeout(initializeExtension, 2000);
    }
}

// Función directa para mostrar el panel
function showFloatingPanel() {
    try {
        // Verificar si el panel ya existe
        let panel = document.querySelector(".noticing-game-panel");

        if (!panel && window.UIManager) {
            // Si no existe, crearlo usando UIManager
            panel = window.UIManager.createFloatingPanel();

            // Modificar el comportamiento del botón Play si existe
            if (panel) {
                const analyzeBtn = panel.querySelector(".noticing-game-button");
                if (analyzeBtn && analyzeBtn.textContent === "Play") {
                    const originalClick = analyzeBtn.onclick;
                    analyzeBtn.onclick = function () {
                        // Limpiar explícitamente cualquier estado anterior
                        window.lastAnalyzedVideoId = null;

                        // Limpiar estado de palabras recientes
                        if (window.WordDetection) {
                            Object.keys(
                                window.WordDetection.recentWords || {},
                            ).forEach(
                                (key) =>
                                    delete window.WordDetection.recentWords[
                                        key
                                    ],
                            );
                            Object.keys(
                                window.WordDetection.notedWords || {},
                            ).forEach(
                                (key) =>
                                    delete window.WordDetection.notedWords[key],
                            );
                        }

                        // Reiniciar contador de palabras superadas si existe
                        if (
                            window.GameLogic &&
                            window.GameLogic.resetOvercomeTotalWords
                        ) {
                            window.GameLogic.resetOvercomeTotalWords();
                        }

                        // Llamar al comportamiento original
                        if (typeof originalClick === "function") {
                            originalClick.call(this);
                        }
                    };
                }
            }
        }

        if (panel) {
            panel.style.display = "block";
            return { success: true };
        } else {
            console.error("No se pudo obtener o crear el panel");
            return {
                success: false,
                error: "No se pudo obtener o crear el panel",
            };
        }
    } catch (err) {
        console.error("Error al mostrar el panel:", err);
        return { success: false, error: err.message };
    }
}

// Función segura para enviar mensajes entre contextos
function safePostMessage(message) {
    try {
        // Asegurarse de que tenga una fuente identificable
        message.source = "noticing-game-extension";

        // Usar el origen correcto para la ventana actual
        const targetOrigin = window.location.origin || "*";

        console.log(
            `Noticing Game: Safe posting message to ${targetOrigin}`,
            message,
        );

        // Usar la función original o la nuestra dependiendo de disponibilidad
        if (window.postMessageOriginal) {
            window.postMessageOriginal.call(window, message, targetOrigin);
        } else {
            window.postMessage(message, targetOrigin);
        }

        return true;
    } catch (err) {
        console.error("Error sending message:", err);
        return false;
    }
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("Noticing Game: Message received in content script:", request);

    if (request.action === "analyzeSubtitles") {
        console.log("Noticing Game: Starting analysis at popup request");

        // Reset cache and state before analysis
        window.lastAnalyzedVideoId = null;

        // Clear word detection state
        if (window.WordDetection) {
            Object.keys(window.WordDetection.recentWords || {}).forEach(
                (key) => delete window.WordDetection.recentWords[key],
            );
            Object.keys(window.WordDetection.notedWords || {}).forEach(
                (key) => delete window.WordDetection.notedWords[key],
            );
        }

        if (typeof SP.analyzeSubtitles === "function") {
            SP.analyzeSubtitles()
                .then((result) => {
                    console.log(
                        "Noticing Game: Sending response to popup:",
                        result,
                    );
                    sendResponse(result);
                })
                .catch((error) => {
                    console.error("Noticing Game: Analysis error:", error);
                    sendResponse({
                        success: false,
                        error: error.message || "Unknown error during analysis",
                    });
                });
        } else {
            sendResponse({
                success: false,
                error: "Analysis function not available",
            });
        }
        return true; // Indicate that the response will be sent asynchronously
    }

    if (request.action === "showPanel") {
        console.log("Noticing Game: Showing panel at popup request");
        // Usar la función simplificada
        const result = showFloatingPanel();
        console.log("Noticing Game: Show panel result:", result);
        sendResponse(result);
        return true;
    }

    // Respuesta por defecto para mensajes no reconocidos
    sendResponse({ success: false, error: "Unknown action" });
    return true;
});

// Exportar la función para uso directo
window.NoticeGameContentUtils = {
    showFloatingPanel: showFloatingPanel,
    safePostMessage: safePostMessage,
    resetAnalysisState: function () {
        window.lastAnalyzedVideoId = null;
        if (window.WordDetection) {
            Object.keys(window.WordDetection.recentWords || {}).forEach(
                (key) => delete window.WordDetection.recentWords[key],
            );
            Object.keys(window.WordDetection.notedWords || {}).forEach(
                (key) => delete window.WordDetection.notedWords[key],
            );
        }
    },
};

console.log(
    "Noticing Game: Content script initialized and ready to receive messages",
);
