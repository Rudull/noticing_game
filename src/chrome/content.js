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
    const statusElements = document.querySelectorAll(".noticing-game-status");
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
      if (status) status.textContent = 'Click "Play" to detect frequent words.';
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
          console.log("Noticing Game: Initialized with visible subtitles mode");
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
              Object.keys(window.WordDetection.recentWords || {}).forEach(
                (key) => delete window.WordDetection.recentWords[key],
              );
              Object.keys(window.WordDetection.notedWords || {}).forEach(
                (key) => delete window.WordDetection.notedWords[key],
              );
            }

            // Limpiar orden de aparición de palabras
            if (
              window.WordSortingModes &&
              typeof window.WordSortingModes.clearAppearanceOrder === "function"
            ) {
              window.WordSortingModes.clearAppearanceOrder();
            }

            // Reiniciar contador de palabras superadas si existe
            if (window.GameLogic && window.GameLogic.resetOvercomeTotalWords) {
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
          console.log("Noticing Game: Sending response to popup:", result);
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
              error: error.message || "Unknown error during analysis",
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
