// Main script injected into YouTube page
console.log("Noticing Game: Content script loaded");

// Guardar referencia al postMessage original si no existe
if (!window.postMessageOriginal) {
    window.postMessageOriginal = window.postMessage.bind(window);
}

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
        "Extension context invalidated in content script, cleaning up...",
    );

    // Limpiar intervalos si existen
    if (window.noticingGameSubtitleInterval) {
        clearInterval(window.noticingGameSubtitleInterval);
        window.noticingGameSubtitleInterval = null;
    }
    if (window.noticingGameHiddenSubtitleInterval) {
        clearInterval(window.noticingGameHiddenSubtitleInterval);
        window.noticingGameHiddenSubtitleInterval = null;
    }

    // Notificar al usuario si es posible
    try {
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );
        statusElements.forEach((element) => {
            element.textContent =
                "Extension reloaded. Please refresh the page to continue using Noticing Game.";
            element.style.color = "orange";
        });

        // También mostrar alerta
        alert(
            "Noticing Game extension was reloaded. Please refresh the page to continue using it.",
        );
    } catch (error) {
        console.warn("Could not update status elements:", error);
    }
}

// Use the SubtitleProcessor module
const SP = window.SubtitleProcessor;
let currentVideoId = SP.getYouTubeVideoId();
let subtitleObserverInterval = null;
let isInitialized = false;

// --- Verificación de versión del servidor al cargar la extensión ---
window.addEventListener("DOMContentLoaded", () => {
    // Usar un pequeño delay para asegurar que todos los módulos estén cargados
    setTimeout(() => {
        // Debug info para verificar que el módulo esté cargado
        if (
            window.ServerVersionCheck &&
            typeof window.ServerVersionCheck.debugInfo === "function"
        ) {
            window.ServerVersionCheck.debugInfo();
        }

        if (
            window.ServerVersionCheck &&
            typeof window.ServerVersionCheck.checkServerVersion === "function"
        ) {
            console.log(
                "Noticing Game: Checking server version on page load...",
            );
            window.ServerVersionCheck.checkServerVersion()
                .then((result) => {
                    console.log(
                        "Noticing Game: Server version check result:",
                        result,
                    );
                    if (!result.ok) {
                        console.log(
                            "Noticing Game: Server connection failed, showing error",
                        );
                        window.ServerVersionCheck.showConnectionError(
                            result.error,
                        );
                    } else if (result.outdated) {
                        console.log(
                            "Noticing Game: Server is outdated, showing warning",
                        );
                        window.ServerVersionCheck.showOutdatedWarning(
                            result.serverVersion,
                            result.minVersion,
                        );
                    } else {
                        console.log(
                            "Noticing Game: Server version is up to date",
                        );
                    }
                })
                .catch((error) => {
                    console.error(
                        "Noticing Game: Error during server version check:",
                        error,
                    );
                    // Mostrar error en la UI si es posible
                    const statusElements = document.querySelectorAll(
                        ".noticing-game-status",
                    );
                    statusElements.forEach((element) => {
                        element.innerHTML = `
                            <div style="color: orange; font-weight: bold;">
                                ⚠️ Could not verify server version. ${error.message || "Unknown error"}
                            </div>
                        `;
                    });
                });
        } else {
            console.warn(
                "Noticing Game: ServerVersionCheck module not available. Available modules:",
                Object.keys(window).filter(
                    (key) => key.includes("Server") || key.includes("Check"),
                ),
            );
        }
    }, 500); // Delay de 500ms para asegurar que los módulos estén cargados
});

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

// Generic URL Change Listener for non-YouTube platforms (Netflix/Disney+)
if (!location.hostname.includes("youtube.com")) {
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log("Noticing Game: URL changed to", lastUrl);

            // Clear subtitle cache
            if (window.SubtitleExtraction && typeof window.SubtitleExtraction.clearCache === "function") {
                window.SubtitleExtraction.clearCache();
            }
            // Clear word detection
            if (window.WordDetection && typeof window.WordDetection.cleanup === "function") {
                window.WordDetection.cleanup();
            }

            // Re-initialize after a delay to let page settle
            setTimeout(initializeExtension, 1500);
        }
    }, 1000);
}

// Function to initialize or reinitialize the extension
function initializeExtension() {
    if (
        window.UIManager &&
        typeof window.UIManager.waitForYouTubeControls === "function"
    ) {
        window.UIManager.waitForYouTubeControls();

        // Verificar que SP esté disponible antes de usarlo
        if (SP && typeof SP.setupURLChangeListener === "function") {
            SP.setupURLChangeListener();
        }

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

        if (SP) {
            if (subtitlesVisible) {
                // Usar el método existente si hay subtítulos visibles
                if (typeof SP.setupSubtitleObserver === "function") {
                    SP.setupSubtitleObserver();
                    console.log(
                        "Noticing Game: Initialized with visible subtitles mode",
                    );
                }
            } else {
                // Usar el nuevo método para detección sin subtítulos visibles
                if (typeof SP.setupHiddenSubtitleDetection === "function") {
                    SP.setupHiddenSubtitleDetection();
                    console.log(
                        "Noticing Game: Initialized with hidden subtitles detection",
                    );
                } else if (typeof SP.setupSubtitleObserver === "function") {
                    console.warn(
                        "Noticing Game: Hidden subtitle detection not available, falling back to normal mode",
                    );
                    SP.setupSubtitleObserver();
                }
            }
        }

        isInitialized = true;
        console.log("Noticing Game: Successfully initialized");
    } else {
        console.error(
            "Noticing Game: UIManager not available, retrying in 2 seconds",
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

                        // Limpiar orden de aparición de palabras
                        if (
                            window.WordSortingModes &&
                            typeof window.WordSortingModes
                                .clearAppearanceOrder === "function"
                        ) {
                            window.WordSortingModes.clearAppearanceOrder();
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
        if (!message || typeof message !== "object") {
            message = { data: message };
        }
        message.source = "noticing-game-extension";

        // Usar el origen correcto para la ventana actual
        const targetOrigin = window.location.origin || "*";

        console.log(
            `Noticing Game: Safe posting message to ${targetOrigin}`,
            message,
        );

        // Usar la función original de manera segura
        if (typeof window.postMessageOriginal === "function") {
            window.postMessageOriginal(message, targetOrigin);
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

    // Verificar contexto al inicio
    if (!isExtensionContextValid()) {
        handleInvalidContext();
        sendResponse({
            success: false,
            error: "Extension context invalidated. Please refresh the page.",
        });
        return;
    }

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

        // Clear word appearance order for new analysis
        if (
            window.WordSortingModes &&
            typeof window.WordSortingModes.clearAppearanceOrder === "function"
        ) {
            window.WordSortingModes.clearAppearanceOrder();
        }

        if (SP && typeof SP.analyzeSubtitles === "function") {
            SP.analyzeSubtitles()
                .then((result) => {
                    console.log(
                        "Noticing Game: Sending response to popup:",
                        result,
                    );
                    // Verificar contexto antes de enviar respuesta
                    if (isExtensionContextValid()) {
                        sendResponse(result);
                    } else {
                        handleInvalidContext();
                    }
                })
                .catch((error) => {
                    console.error("Noticing Game: Analysis error:", error);
                    // Verificar contexto antes de enviar respuesta
                    if (isExtensionContextValid()) {
                        sendResponse({
                            success: false,
                            error:
                                error.message ||
                                "Unknown error during analysis",
                        });
                    } else {
                        handleInvalidContext();
                    }
                });
        } else {
            console.error("Noticing Game: SubtitleProcessor not available");
            if (isExtensionContextValid()) {
                sendResponse({
                    success: false,
                    error: "Subtitle processor not available. Please reload the page.",
                });
            } else {
                handleInvalidContext();
            }
        }
        return true; // Indicate that the response will be sent asynchronously
    }

    if (request.action === "showPanel") {
        console.log("Noticing Game: Showing panel at popup request");
        // Usar el método centralizado para abrir el panel y sincronizar el interruptor
        let result = { success: false, error: "Panel not available" };
        if (
            window.NoticingGamePanel &&
            typeof window.NoticingGamePanel.open === "function"
        ) {
            window.NoticingGamePanel.open();
            result = { success: true };
        } else {
            // Fallback legacy
            result = showFloatingPanel();
        }
        console.log("Noticing Game: Show panel result:", result);

        // Verificar contexto antes de enviar respuesta
        if (isExtensionContextValid()) {
            sendResponse(result);
        } else {
            handleInvalidContext();
        }
        return true;
    }

    // Respuesta por defecto para mensajes no reconocidos
    if (isExtensionContextValid()) {
        sendResponse({ success: false, error: "Unknown action" });
    } else {
        handleInvalidContext();
    }
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
        // Clear word appearance order
        if (
            window.WordSortingModes &&
            typeof window.WordSortingModes.clearAppearanceOrder === "function"
        ) {
            window.WordSortingModes.clearAppearanceOrder();
        }
    },
};

console.log(
    "Noticing Game: Content script initialized and ready to receive messages",
);

// --- Blur Subtitles Feature (Direct Element Manipulation) ---

let subtitleBlurEnabled = false;
let blurAnimationId = null;
let processedElements = new WeakSet(); // Track elements we've added listeners to

// Inject a style element for blur effects
let blurStyleElement = null;

// CSS for blur effects - extracted for reuse in Shadow DOMs
// CSS for blur effects - extracted for reuse in Shadow DOMs
const BLUR_CSS = `
    /* 
     * Blur subtitle elements
     */
    
    /* Native YouTube subtitles */
    .ytp-caption-segment,
    .captions-text,
    .ytp-caption-window-bottom span,
    .ytp-caption-window-top span,
    .ytp-caption-window-rollup span,
    
    /* Language Reactor subtitles */
    .lln-word,
    .lln-subs-line,
    .lln-sub-text,

    /* Netflix subtitles */
    .player-timedtext-text-container span {
        filter: blur(6px) !important;
        opacity: 0.7 !important;
        background-color: rgba(0, 0, 0, 0.5) !important;
        border-radius: 3px !important;
        padding: 2px 4px !important;
        transition: filter 0.15s ease-out, opacity 0.15s ease-out !important;
    }

    /* Disney+ subtitles - TARGET TEXT ELEMENTS ONLY (Fixes full screen shadow) */
    .dss-subtitle-renderer span,
    .dss-subtitle-renderer p,
    .shutter-subtitle-container span,
    .shutter-subtitle-container p,
    .closed-captions-renderer span,
    .closed-captions-renderer p,
    [class*="subtitle-renderer"] span,
    [class*="subtitle-renderer"] p,
    [class*="caption-renderer"] span,
    [class*="caption-renderer"] p {
        filter: blur(6px) !important;
        opacity: 0.9 !important; /* More visible */
        background-color: rgba(0, 0, 0, 0.7) !important; /* Darker background to locate them easily */
        border-radius: 3px !important;
        padding: 2px 4px !important;
        transition: filter 0.15s ease-out, opacity 0.15s ease-out !important;
        pointer-events: auto !important; /* Ensure hover works */
        cursor: pointer !important;
    }
    
    /* 
     * Reveal on hover - container hover reveals ALL words at once
     */
    
    /* YouTube */
    .ytp-caption-window-bottom:hover .ytp-caption-segment,
    .ytp-caption-window-bottom:hover span,
    .ytp-caption-window-top:hover .ytp-caption-segment,
    .ytp-caption-window-top:hover span,
    .ytp-caption-window-rollup:hover .ytp-caption-segment,
    .ytp-caption-window-rollup:hover span,
    
    /* Language Reactor */
    .lln-subs:hover .lln-word,
    .lln-subs-line:hover .lln-word,
    .lln-subs-wrap:hover .lln-word,
    .lln-sub:hover .lln-word,
    
    /* Netflix */
    .player-timedtext-text-container:hover span,
    .player-timedtext-text-container span:hover,
    
    /* Disney+ & Generic - Parent/Element hover reveals */
    .dss-subtitle-renderer:hover span,
    .dss-subtitle-renderer:hover p,
    .shutter-subtitle-container:hover span,
    .shutter-subtitle-container:hover p,
    .closed-captions-renderer:hover span,
    .closed-captions-renderer:hover p,
    [class*="subtitle-renderer"]:hover span,
    [class*="subtitle-renderer"]:hover p,
    [class*="caption-renderer"]:hover span,
    [class*="caption-renderer"]:hover p,
    
    /* Fallback: individual hover */
    .lln-word:hover,
    .ytp-caption-segment:hover,
    span:hover,
    p:hover {
        filter: blur(0) !important;
        opacity: 1 !important;
        background-color: rgba(0, 0, 0, 0.8) !important;
    }
    
    /* 
     * PROTECTION: Noticing Game panel elements are NEVER affected
     */
    #noticing-game-floating-panel,
    #noticing-game-floating-panel *,
    #noticing-game-floating-panel span,
    #noticing-game-floating-panel .lln-word,
    .noticing-game-panel,
    .noticing-game-panel *,
    .noticing-game-panel span {
        filter: none !important;
        opacity: 1 !important;
    }
`;

function ensureBlurStylesheet() {
    if (blurStyleElement) return;

    blurStyleElement = document.createElement('style');
    blurStyleElement.id = 'noticing-game-blur-styles';
    blurStyleElement.textContent = BLUR_CSS;
    document.head.appendChild(blurStyleElement);
    console.log("Noticing Game: Blur stylesheet injected");

    // Also try to inject into shadow roots immediately
    injectStylesIntoShadowRoots();
}

function removeBlurStylesheet() {
    if (blurStyleElement) {
        blurStyleElement.remove();
        blurStyleElement = null;
    }
    // Note: We don't easily remove styles from Shadow Roots without tracking them all, 
    // but toggling class/style is usually enough. For now, we rely on the specific selectors 
    // to not match when the feature is off (requires logic update if we want perfect cleanup).
    // A full reload fixes it, but typically users just toggle it.
}

// Function to find and inject styles into Open Shadow Roots
function injectStylesIntoShadowRoots() {
    function applyToShadow(root) {
        if (!root.getElementById('noticing-game-shadow-blur')) {
            const style = document.createElement('style');
            style.id = 'noticing-game-shadow-blur';
            style.textContent = BLUR_CSS;
            root.appendChild(style);
            console.log("Noticing Game: Injected blur styles into a Shadow Root");
        }
    }

    // Walk the DOM tree to find shadow roots
    function checkNode(node) {
        if (node.shadowRoot) {
            applyToShadow(node.shadowRoot);
            checkNode(node.shadowRoot); // Recurse into the shadow root
        }

        let child = node.firstElementChild;
        while (child) {
            checkNode(child);
            child = child.nextElementSibling;
        }
    }

    checkNode(document.body);
}

// Apply blur to a single subtitle element (CSS does the actual styling)
function applyBlurToElement(element) {
    if (!element || processedElements.has(element)) return;

    // Mark as processed (just for tracking, CSS handles the blur)
    processedElements.add(element);
}

// Remove blur from an element (CSS handles this, but we track it)
function removeBlurFromElement(element) {
    // Nothing to do - CSS is removed when stylesheet is removed
}

// Find and process all subtitle elements
let hasLoggedOnce = false;

function processSubtitleElements() {
    if (!subtitleBlurEnabled) return;

    // Selectors for YouTube, Netflix, and Language Reactor subtitles
    const selectors = [
        '.ytp-caption-segment',
        '.captions-text',
        '.ytp-caption-window-bottom span',
        '.ytp-caption-window-top span',
        '.ytp-caption-window-rollup span',
        '.player-timedtext-text-container span', // Netflix
        '.dss-subtitle-renderer span', // Disney+
        '.shutter-subtitle-container span', // Disney+ (alternate)
        '.closed-captions-renderer span', // Disney+ (alternate)
        '.lln-word', // Language Reactor
        '.lln-subs-line',
        '.lln-sub-text'
    ];

    let foundCount = 0;

    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            // Only process if has text content
            if (el.textContent && el.textContent.trim().length > 0) {
                foundCount++;
                applyBlurToElement(el);
            }
        });
    });

    // Log once when we first start finding elements (or not)
    if (!hasLoggedOnce) {
        hasLoggedOnce = true;
        console.log(`Noticing Game: First scan found ${foundCount} subtitle elements`);

        // Also log what selectors found what
        selectors.forEach(selector => {
            const count = document.querySelectorAll(selector).length;
            if (count > 0) {
                console.log(`  - "${selector}": ${count} elements`);
            }
        });
    }

    // Log periodically (not every frame to avoid console spam)
    if (foundCount > 0 && Math.random() < 0.01) {
        console.log(`Noticing Game: Processing ${foundCount} subtitle elements`);
    }
}

// Remove blur from all subtitle elements
function removeAllBlur() {
    const selectors = [
        '.ytp-caption-segment',
        '.captions-text',
        '.ytp-caption-window-bottom span',
        '.ytp-caption-window-top span',
        '.ytp-caption-window-rollup span'
    ];

    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => removeBlurFromElement(el));
    });
}

// Start monitoring for subtitle elements
function startSubtitleBlurMonitor() {
    if (blurAnimationId) return; // Already running

    // Inject the stylesheet first
    ensureBlurStylesheet();
    hasLoggedOnce = false; // Reset for new session

    console.log("Noticing Game: Starting subtitle blur monitor (direct mode)");

    // Use RAF loop to continuously find and blur new subtitle elements
    let frameCount = 0;

    function updateLoop() {
        if (!subtitleBlurEnabled) return;

        processSubtitleElements();

        // Every ~60 frames (approx 1s), check for new shadow roots
        frameCount++;
        if (frameCount % 60 === 0) {
            injectStylesIntoShadowRoots();
        }

        blurAnimationId = requestAnimationFrame(updateLoop);
    }

    updateLoop();
}

// Stop the blur monitor
function stopSubtitleBlurMonitor() {
    if (blurAnimationId) {
        cancelAnimationFrame(blurAnimationId);
        blurAnimationId = null;
    }

    // Remove blur from all elements
    removeAllBlur();

    // Remove the stylesheet
    removeBlurStylesheet();

    // Reset processed elements tracker
    processedElements = new WeakSet();
    hasLoggedOnce = false;

    console.log("Noticing Game: Subtitle blur monitor stopped");
}

// Apply blur setting
function applyBlurSubtitleSetting(blurEnabled) {
    subtitleBlurEnabled = blurEnabled;

    if (blurEnabled) {
        console.log("Noticing Game: Subtitle blurring ENABLED (overlay mode)");
        startSubtitleBlurMonitor();
    } else {
        console.log("Noticing Game: Subtitle blurring DISABLED");
        stopSubtitleBlurMonitor();
    }
}

// Initial check when content script loads
if (chrome && chrome.storage && chrome.storage.local) {
    console.log("Noticing Game: Setting up blur subtitles feature...");

    chrome.storage.local.get(['blurSubtitles'], (result) => {
        console.log("Noticing Game: Initial blur setting:", result.blurSubtitles);
        applyBlurSubtitleSetting(result.blurSubtitles || false);
    });

    // Listen for storage changes to update dynamically
    chrome.storage.onChanged.addListener((changes, namespace) => {
        console.log("Noticing Game: Storage changed:", namespace, changes);
        if (namespace === 'local' && changes.blurSubtitles) {
            console.log("Noticing Game: Blur setting changed to:", changes.blurSubtitles.newValue);
            applyBlurSubtitleSetting(changes.blurSubtitles.newValue);
        }
    });

    console.log("Noticing Game: Blur subtitles feature ready");
} else {
    console.error("Noticing Game: chrome.storage not available!");
}
