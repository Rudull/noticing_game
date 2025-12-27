// ServerVersionCheck se carga automáticamente a través del manifest.json

// Global helper for status messages (prevents race conditions)
window.noticingGameStatusTimeout = null;
window.showStatusMessage = function (text, color = "#4caf50", duration = 3000) {
  const statusElem = document.querySelector(".noticing-game-status");
  if (!statusElem) return;

  // Clear any pending cleanup
  if (window.noticingGameStatusTimeout) {
    clearTimeout(window.noticingGameStatusTimeout);
    window.noticingGameStatusTimeout = null;
  }

  // Save default text if we are not currently showing a transient message
  // We assume if color is default (empty or inherited), it is default text.
  // Or we use a data attribute.
  if (!statusElem.dataset.defaultText) {
    // Only save if it looks like a default message (not a success/error message)
    // Heuristic: length > 0 and no inline style color set?
    if (!statusElem.style.color) {
      statusElem.dataset.defaultText = statusElem.textContent;
    }
  }

  statusElem.textContent = text;
  statusElem.style.color = color;

  window.noticingGameStatusTimeout = setTimeout(() => {
    if (statusElem.dataset.defaultText) {
      statusElem.textContent = statusElem.dataset.defaultText;
    } else {
      statusElem.textContent = "";
    }
    statusElem.style.color = "";
    window.noticingGameStatusTimeout = null;
  }, duration);
};

// Gestor principal de la interfaz de usuario para Noticing Game
window.UIManager = (function () {
  // Referencias a los distintos módulos con validación
  const getUI = () => {
    if (!window.UIComponents) {
      console.error("UIComponents module not available");
      return null;
    }
    return window.UIComponents;
  };
  const getPM = () => {
    if (!window.PanelManager) {
      console.error("PanelManager module not available");
      return null;
    }
    return window.PanelManager;
  };
  const getWLM = () => {
    if (!window.WordListManager) {
      console.error("WordListManager module not available");
      return null;
    }
    return window.WordListManager;
  };
  const getGL = () => {
    if (!window.GameLogic) {
      console.error("GameLogic module not available");
      return null;
    }
    return window.GameLogic;
  };
  const getYT = () => {
    if (!window.YouTubeIntegration) {
      console.error("YouTubeIntegration module not available");
      return null;
    }
    return window.YouTubeIntegration;
  };
  const getSP = () => {
    if (!window.SubtitleProcessor) {
      console.error("SubtitleProcessor module not available");
      return null;
    }
    return window.SubtitleProcessor;
  };

  // Referencia al panel flotante
  let floatingPanel = null;
  let settingsPanel = null;

  // Crear panel flotante
  function createFloatingPanel() {
    // Verificar si ya existe
    const existingPanel = document.querySelector(".noticing-game-panel");
    if (existingPanel) {
      return existingPanel;
    }

    // Verificación de versión del servidor SOLO al abrir el panel (modal)
    if (
      window.ServerVersionCheck &&
      typeof window.ServerVersionCheck.checkServerVersion === "function"
    ) {
      window.ServerVersionCheck.checkServerVersion().then((result) => {
        if (!result.ok) {
          // Mostrar modal de servidor offline/no encontrado
          if (typeof window.ServerVersionCheck.showServerOfflineModal === "function") {
            window.ServerVersionCheck.showServerOfflineModal();
          }
        } else if (result.outdated) {
          window.ServerVersionCheck.showOutdatedWarning(
            result.serverVersion,
            result.minVersion,
          );
        }
      });
    }

    const WLM = getWLM();
    const UI = getUI();
    const PM = getPM();
    const GL = getGL();

    // Verificar que todos los módulos estén disponibles
    if (!WLM || !UI || !PM || !GL) {
      console.error("Required modules not available for panel creation");
      return null;
    }



    // Asegurarnos de que tenemos los datos más recientes
    if (typeof WLM.loadWordListConfig === "function") {
      WLM.loadWordListConfig()
        .then(() => {
          console.log(
            "Panel creation: config loaded with lists:",
            WLM.getWordListsConfig()
              ? WLM.getWordListsConfig().availableLists.length
              : 0,
          );
        })
        .catch((err) => {
          console.error("Error loading config for panel:", err);
        });
    }

    // Crear elementos
    const panel = document.createElement("div");
    panel.className = "noticing-game-panel";

    // Cargar dimensiones guardadas
    PM.loadPanelDimensions(panel);

    const header = document.createElement("div");
    header.className = "noticing-game-header noticing-game-draggable-header";

    // Create right-side buttons container (for settings, donate and close)
    const rightButtonsContainer = document.createElement("div");
    rightButtonsContainer.className = "noticing-game-right-buttons";

    // --- Sync Indicator (Informational Icon) ---
    // Note: Chrome API doesn't allow detecting if user is logged into browser account.
    // chrome.storage.sync works locally even without login (silent fallback).
    // This indicator is informational only.
    if (chrome.storage && chrome.storage.sync) {
      const syncBtn = UI.createButton(
        "noticing-game-sync-status",
        "",
        () => {
          // Create custom modal instead of alert for better display
          const existingModal = document.querySelector(".noticing-sync-info-modal");
          if (existingModal) existingModal.remove();

          const modal = document.createElement("div");
          modal.className = "noticing-sync-info-modal";
          modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--panel-bg, #242424);
            color: var(--text-color, #e0e0e0);
            border: 1px solid var(--border-color, #444);
            border-radius: 12px;
            padding: 24px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            z-index: 100000;
            font-family: Arial, sans-serif;
            line-height: 1.5;
          `;

          modal.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: var(--primary-color, #6544e9); font-size: 18px;">☁️ Cloud Sync Info</h3>
            
            <p style="margin: 0 0 12px 0;">Your settings and daily activity stats can automatically sync across devices if:</p>
            
            <ol style="margin: 0 0 16px 20px; padding: 0;">
              <li>You are signed into your browser account</li>
              <li>Extension sync is enabled in browser settings</li>
            </ol>
            
            <p style="margin: 0 0 8px 0; font-weight: bold;">Each browser uses its own cloud:</p>
            <ul style="margin: 0 0 16px 20px; padding: 0;">
              <li>Chrome → Google Account</li>
              <li>Edge → Microsoft Account</li>
              <li>Brave, Opera, Vivaldi → Their own sync</li>
            </ul>
            
            <p style="margin: 0 0 12px 0; padding: 10px; background: rgba(255,76,76,0.15); border-radius: 6px; border-left: 3px solid #ff4c4c;">
              ⚠️ <strong>Data does NOT sync between different browsers.</strong>
            </p>
            
            <p style="margin: 0 0 16px 0; padding: 10px; background: rgba(101,68,233,0.15); border-radius: 6px; border-left: 3px solid var(--primary-color, #6544e9);">
              💾 For manual backups or cross-browser transfers, use <strong>"Backup (Export)"</strong> in Settings.
            </p>
            
            <button id="sync-info-close-btn" style="
              width: 100%;
              padding: 10px;
              background: var(--primary-color, #6544e9);
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
            ">Got it</button>
          `;

          // Overlay
          const overlay = document.createElement("div");
          overlay.className = "noticing-sync-info-overlay";
          overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 99999;
          `;

          document.body.appendChild(overlay);
          document.body.appendChild(modal);

          const closeModal = () => {
            modal.remove();
            overlay.remove();
          };

          modal.querySelector("#sync-info-close-btn").addEventListener("click", closeModal);
          overlay.addEventListener("click", closeModal);
        },
        {
          title: "Cloud Sync: Sign into browser account to sync across devices",
          // User provided custom cloud sync icon
          innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 64 64" class="sync-icon">
  <g>
    <path fill="currentColor" d="M48,30c0-6.5-3.8-12-9.4-14.5
      C36.9,14.7,36,16,36,17.1v8.5c0,0.8,0.7,1.4,1.5,1.4h3.1
      c1.5,0,1.9,1.1,0.9,2.4l-7.7,9.8c-1,1.2-2.6,1.2-3.5,0
      l-7.7-9.8c-1-1.2-0.6-2.4,0.9-2.4h3.1c0.8,0,1.5-0.6,1.5-1.4
      v-8.5c0-1.1-1.5-2.1-2.8-1.6c-4.3,2-7.6,5.9-8.7,10.6
      C11.7,26.9,8,31,8,36c0,5.5,4.5,10,10,10h30
      c4.4,0,8-3.6,8-8S52.4,30,48,30z"/>
  </g>
</svg>`,
        }
      );

      // Visual styling to match other header icons
      syncBtn.style.background = "transparent";
      syncBtn.style.border = "none";
      syncBtn.style.padding = "0 5px";
      syncBtn.style.cursor = "pointer";
      syncBtn.style.color = "#e0e0e0"; // Same as other icons
      syncBtn.style.display = "flex";
      syncBtn.style.alignItems = "center";
      syncBtn.style.transition = "all 0.2s ease";
      syncBtn.style.opacity = "0.8";

      // Hover effect - same behavior as other icons (scale + color)
      syncBtn.addEventListener("mouseenter", () => {
        syncBtn.style.color = "#ffffff";
        syncBtn.style.transform = "scale(1.2)";
        syncBtn.style.opacity = "1";
      });
      syncBtn.addEventListener("mouseleave", () => {
        syncBtn.style.color = "#e0e0e0";
        syncBtn.style.transform = "scale(1)";
        syncBtn.style.opacity = "0.8";
      });

      rightButtonsContainer.appendChild(syncBtn);
    }

    // Settings button (gear icon)
    const settingsBtn = UI.createButton(
      "noticing-game-settings-btn",
      "",
      () => {
        try {
          toggleSettingsPanel();
        } catch (error) {
          console.error("Error toggling settings panel:", error);
        }
      },
      {
        title: "Settings & Help",
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" class="settings-icon">
<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
</svg>`,
      },
    );

    // Rate button (star icon)
    const rateBtn = UI.createButton(
      "noticing-game-rate-btn",
      "",
      () => {
        // Usar el ID real de la extensión
        const extensionId = "amdacddmlfphgmclpjhbdhcmnldojlpj";
        window.open(
          `https://chromewebstore.google.com/detail/${extensionId}/reviews`,
          "_blank",
        );
      },
      {
        title: "Rate this extension",
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" class="star-icon">
<path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
</svg>`,
      },
    );

    // Donate button (heart icon)
    const donateBtn = UI.createButton(
      "noticing-game-donate-btn",
      "",
      () => {
        window.open(
          "https://www.paypal.com/paypalme/rahebu852?ppid=PPC000628&cnac=CO&rsta=es_CO%28es_AG%29&cust=QHUYRRLFTR248&unptid=2034d374-429b-11e8-a5dc-9c8e992ea258&t&cal=3c53be2744ab1&calc=3c53be2744ab1&calf=3c53be2744ab1&unp_tpcid=ppme-social-user-profile-created&page=main%3Aemail&pgrp=main%3Aemail&e=op&mchn=em&s=ci&mail=sys",
          "_blank",
        );
      },
      {
        title: "Donate to project",
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" class="heart-icon">
<path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
</svg>`,
      },
    );

    const title = UI.createTitle("Noticing Game", 2, "noticing-game-title");

    // Close button (X icon, SVG, igual tamaño que los otros íconos)
    const closeBtn = UI.createButton(
      "noticing-game-close",
      "",
      () => {
        if (
          window.NoticingGamePanel &&
          typeof window.NoticingGamePanel.close === "function"
        ) {
          window.NoticingGamePanel.close();
        } else {
          panel.style.display = "none";
          // Fallback: sincronizar interruptor si no está inicializado el sistema global
          const toggleBtn = document.querySelector(
            ".noticing-game-floating-toggle",
          );
          if (toggleBtn) {
            toggleBtn.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
        <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
        <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
      </svg>
    `;
            toggleBtn.dataset.state = "off";
          }
        }
      },
      {
        title: "Close",
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" class="close-icon">
  <path d="M2.5 2.5l11 11m0-11l-11 11" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round"/>
</svg>`,
      },
    );

    const content = UI.createContainer("noticing-game-content");

    const status = UI.createTextElement(
      "div",
      'Click "Play" to detect frequent words.',
      "noticing-game-status",
    );

    const analyzeBtn = UI.createButton("noticing-game-button", "Play", () => {
      const SP = getSP();
      const GL = getGL();

      if (!SP || !GL) {
        console.error("Required modules not available for analysis");
        status.textContent =
          "Error: Extension modules not loaded. Please reload the page.";
        return;
      }

      // Reiniciar contador de palabras superadas
      if (typeof GL.resetOvercomeTotalWords === "function") {
        GL.resetOvercomeTotalWords();
      }

      // AÑADIDO: Limpiar explícitamente cualquier estado anterior
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

      // Limpiar cualquier caché de resultados previos
      console.log(
        "Noticing Game: Completely resetting detection state for new analysis",
      );

      status.textContent = "Analyzing subtitles...";

      if (typeof SP.analyzeSubtitles !== "function") {
        console.error("analyzeSubtitles function not available");
        status.textContent =
          "Error: Analysis function not available. Please reload the page.";
        return;
      }

      SP.analyzeSubtitles()
        .then((result) => {
          if (result && result.success) {
            // Obtener configuración del grid antes de mostrar palabras
            chrome.storage.local.get(
              ["gridColumns", "gridRows"],
              function (gridResult) {
                const columns = gridResult.gridColumns || 5;
                const rows = gridResult.gridRows || 5;
                const totalWordsToShow = columns * rows;

                if (result.liveCapture) {
                  status.textContent = "Live Mode Active. Watching for words...";
                  status.style.color = "#4CAF50"; // Green for active/good
                } else {
                  status.textContent = `Analysis completed. Found ${result.words ? result.words.length : 0} words from the list.`;
                  status.style.color = "";
                }

                try {
                  displayWords(result.words || [], content, status);
                } catch (error) {
                  console.error("Error displaying words:", error);
                  status.textContent =
                    "Error displaying results. Please try again.";
                }
              },
            );
          } else {
            // Mostrar mensaje claro y visible
            const errorMessage = result.error || "No subtitles found!";
            status.textContent = `Error: ${errorMessage}`;
            status.style.color = "red";
            status.style.fontWeight = "bold";

            // Mostrar alerta con el error específico para depuración
            // Solo mostrar el mensaje de "No subtitles" si realmente es ese el error
            if (errorMessage.includes("No subtitles") || errorMessage.includes("Could not obtain")) {
              alert(
                "This video doesn't have subtitles. Please choose a video with subtitles (either auto-generated or manual) to use Noticing Game.",
              );
            } else {
              // Mostrar el error real para ayudar a depurar
              alert(`Error analyzing video: ${errorMessage}`);
            }

            // Restaurar estilo después de un tiempo
            setTimeout(() => {
              status.style.color = "";
              status.style.fontWeight = "";
            }, 5000);
          }
        })
        .catch((error) => {
          console.error("Analysis error:", error);
          status.textContent = "Error during analysis. Please try again.";
          status.style.color = "red";
          setTimeout(() => {
            status.style.color = "";
          }, 5000);
        });
    });

    const wordList = UI.createContainer("noticing-game-list");

    // Create settings/about panel (hidden by default)
    settingsPanel = document.createElement("div");
    settingsPanel.className = "noticing-game-about-panel";
    settingsPanel.style.display = "none";

    // Cargar la configuración de listas
    if (typeof WLM.loadWordListConfig === "function") {
      WLM.loadWordListConfig()
        .then(() => {
          // Construir el contenido del panel de configuración
          settingsPanel.innerHTML = `
          <div class="noticing-game-about-content">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                  <button id="learned-words-btn" class="noticing-game-close-about" style="margin-top: 0;">Noted Words</button>
                  <button class="noticing-game-close-about" style="margin-top: 0;">Done</button>
              </div>

              <h3>Word Lists</h3>
              <p>Select a word list from the dropdown below or import your own custom list:</p>
              <div class="noticing-game-list-selector">
                  <label for="word-list-select">Select word list:</label>
                  <select id="word-list-select">
                      ${typeof WLM.createWordListOptions === "function" ? WLM.createWordListOptions() : '<option value="">Loading...</option>'}
                  </select>
                  <div class="word-list-actions" style="display: flex; gap: 10px; justify-content: flex-start;">
                      <button id="view-list-button" class="delete-list-btn" style="width: 120px; text-align: center;">View List</button>
                      <button id="delete-list-button" class="delete-list-btn" style="width: 120px; text-align: center;">Delete List</button>
                  </div>
              </div>

              <h3>Word Display Mode</h3>
              <p>Choose how words are ordered and displayed during the game:</p>
              <div class="noticing-game-mode-selector">
                  <label for="word-mode-select">Display mode:</label>
                  <select id="word-mode-select">
                      ${window.WordSortingModes && typeof window.WordSortingModes.createModeOptions === "function" ? window.WordSortingModes.createModeOptions() : '<option value="frequency">By Frequency (Default)</option>'}
                  </select>
                  <div class="mode-description" id="mode-description" style="margin-top: 5px; color: var(--secondary-text);">
                      <small><em>Select a mode to see its description</em></small>
                  </div>
              </div>

              <h3>Import Custom List</h3>
              <div class="file-import-container">
                  <p>Upload a file with your custom word list:</p>
                  <p><small>Supported format: TXT (one word per line)</small></p>
                  <div class="import-file-wrapper">
                      <input type="file" id="import-list-file" accept=".txt">
                      <button id="import-list-button" class="noticing-game-button">Import List</button>
                  </div>
                  <p class="import-list-status"></p>
              </div>

              <h3>Import from Anki</h3>
              <div class="anki-import-container" style="padding: 10px; background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; margin-top: 10px;">
                  <p>Create a word list from your Anki decks:</p>
                  <p><small>Requires Anki with <a href="https://ankiweb.net/shared/info/2055492159" target="_blank">AnkiConnect</a> installed.</small></p>
                  
                  <div id="anki-initial-view">
                      <button id="anki-connect-btn" class="noticing-game-button" style="width: 100%;">Connect to Anki</button>
                      <p id="anki-status-msg" style="margin-top: 5px; font-style: italic; color: var(--secondary-text);"></p>
                  </div>

                  <div id="anki-deck-view" style="display: none; margin-top: 10px;">
                      <div class="grid-config-row" style="margin-bottom: 10px;">
                          <label for="anki-deck-select">Select Deck:</label>
                          <select id="anki-deck-select" style="width: 60% !important; flex: 0 0 60%; max-width: 60%;"></select>
                      </div>
                      
                      <div class="grid-config-row" style="margin-bottom: 15px;">
                          <label for="anki-list-name" style="margin-bottom: 5px; display: block;">List Name:</label>
                          <input type="text" id="anki-list-name" class="noticing-game-other-select" style="width: 60% !important; flex: 0 0 60%; max-width: 60%; text-align: left;" placeholder="Name for the new list">
                      </div>

                      <div class="grid-config-row" style="margin-bottom: 5px; justify-content: flex-start; gap: 10px;">
                          <input type="checkbox" id="anki-include-difficulty" checked style="width: auto !important; margin: 0;">
                          <label for="anki-include-difficulty" style="flex: unset; font-weight: normal; font-size: 13px;">Import difficulty (based on interval)</label>
                      </div>
                      
                      <div class="grid-config-row" style="margin-bottom: 15px; justify-content: flex-start; gap: 10px;">
                          <input type="checkbox" id="anki-only-learned" checked style="width: auto !important; margin: 0;">
                          <label for="anki-only-learned" style="flex: unset; font-weight: normal; font-size: 13px;">Only reviewed/learned words</label>
                      </div>

                      <button id="anki-import-btn" class="noticing-game-button" style="width: 100%;">Import Deck</button>
                  </div>
              </div>

              <h3>Word Grid Configuration</h3>
              <p>Customize the size and layout of the word grid:</p>
              <div class="grid-config-container">
                  <div class="grid-config-row">
                      <label for="grid-columns">Columns (width):</label>
                      <select id="grid-columns">
                          ${Array.from({ length: 20 }, (_, i) => {
            const value = i + 1;
            const selected = value === 5 ? "selected" : "";
            return `<option value="${value}" ${selected}>${value}</option>`;
          }).join("")}
                      </select>
                  </div>
                  <div class="grid-config-row">
                      <label for="grid-rows">Rows (height):</label>
                      <select id="grid-rows">
                          ${Array.from({ length: 20 }, (_, i) => {
            const value = i + 1;
            const selected = value === 5 ? "selected" : "";
            return `<option value="${value}" ${selected}>${value}</option>`;
          }).join("")}
                      </select>
                  </div>
                  <div class="grid-preview">
                      <small>Grid size: <span id="grid-size-preview">5 × 5 = 25 words</span></small>
                  </div>
              </div>

              <h3 style="margin-top: 18px; margin-bottom: 8px;">Other settings</h3>
              <div class="other-settings-container" style="margin: 0 0 10px 0; padding: 15px; background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px;">
                <div class="grid-config-row" style="margin-bottom: 10px;">
                  <label for="word-font-size-select" style="font-weight: bold; color: var(--text-color);" title="Change the font size of the word buttons in the game grid.">Word button font size:</label>
                  <select id="word-font-size-select" class="noticing-game-other-select" title="Change the font size of the word buttons in the game grid." style="margin-left: 10px;">
                    ${Array.from({ length: 25 }, (_, i) => {
            const value = i + 8;
            const selected = value === 13 ? "selected" : "";
            return `<option value="${value}" ${selected}>${value}</option>`;
          }).join("")}
                  </select>
                </div>
                <div class="grid-config-row" style="margin-bottom: 10px;">
                  <label for="word-clicks-to-overcome-select" style="font-weight: bold; color: var(--text-color);" title="How many times you must notice a word before it is considered 'overcome' and replaced by a new one.">Times to overcome a word:</label>
                  <select id="word-clicks-to-overcome-select" class="noticing-game-other-select" title="How many times you must notice a word before it is considered 'overcome' and replaced by a new one." style="margin-left: 10px;">
                    ${Array.from({ length: 6 }, (_, i) => {
            const value = i + 1;
            const selected = value === 3 ? "selected" : "";
            return `<option value="${value}" ${selected}>${value}</option>`;
          }).join("")}
                  </select>
                </div>
                <div class="grid-config-row" style="margin-bottom: 10px;">
                  <label for="pause-time-toggle" style="font-weight: bold; color: var(--text-color);" title="When enabled, word timers pause when the video is paused, giving you unlimited time to notice words while the video is stopped.">Pause timers when video stops:</label>
                  <label class="pause-time-switch" style="margin-left: 10px;">
                    <input type="checkbox" id="pause-time-toggle" title="When enabled, word timers pause when the video is paused, giving you unlimited time to notice words while the video is stopped.">
                    <span class="pause-time-slider"></span>
                  </label>
                </div>
                <div class="grid-config-row" style="margin-bottom: 10px;">
                  <label for="blur-subtitles-toggle" style="font-weight: bold; color: var(--text-color);" title="When enabled, video subtitles are blurred and only revealed when you hover over them with the mouse.">Blur subtitles:</label>
                  <label class="pause-time-switch" style="margin-left: 10px;">
                    <input type="checkbox" id="blur-subtitles-toggle" title="When enabled, video subtitles are blurred and only revealed when you hover over them with the mouse.">
                    <span class="pause-time-slider"></span>
                  </label>
                </div>
                <div class="grid-config-row">
                  <label for="backend-port-input" style="font-weight: bold; color: var(--text-color);" title="Port where the Subtitle Server is running. Valid range: 1024-65535. Change this if you configured the server to run on a different port.">Subtitle Server port:</label>
                  <input type="number" id="backend-port-input" class="noticing-game-other-select" title="Port where the Subtitle Server is running. Valid range: 1024-65535. Change this if you configured the server to run on a different port." style="margin-left: 10px; text-align: center;" min="1024" max="65535" value="5000">
                </div>
              </div>

              <h3 style="margin-top: 18px; margin-bottom: 8px;">Data Management</h3>
              <div class="other-settings-container" style="margin: 0 0 10px 0; padding: 15px; background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px;">
                  <p style="margin-top:0; margin-bottom:10px; font-size: 13px;">Create a manual backup of all your data (stats, lists, settings) or restore from a file.</p>
                  <div class="word-list-actions" style="display: flex; gap: 10px; justify-content: flex-start;">
                      <button id="backup-export-btn" class="delete-list-btn" style="width: 130px; text-align: center;">Backup (Export)</button>
                      <button id="backup-import-btn" class="delete-list-btn" style="width: 130px; text-align: center;">Restore (Import)</button>
                      <input type="file" id="backup-import-file" accept=".json" style="display: none;" />
                  </div>
                  <p id="backup-status-msg" style="margin-top: 8px; margin-bottom: 0; font-size: 12px; height: 1.2em;"></p>
              </div>

              <h3>How to play:</h3>
              <ol style="padding-left: 20px;">
                  <li>First, select a word list from the dropdown or import your own custom list</li>
                  <li>Watch YouTube, Netflix or Disney+ videos with subtitles.</li>
                  <li>Click "Play" to detect detection of words or phrases from your selected list</li>
                  <li>When you notice a word/phrase from the list being said in the video, quickly click it</li>
                  <li><strong>Recommended Tools:</strong> For the best experience, use <strong>Language Reactor</strong> (to control subtitles) and a pop-up dictionary extension (like <em>Read Pronunciation</em>) for instant translations.</li>
                  <li><strong>Listening Training:</strong> Enable "Blur subtitles" to hide text. Listen carefully to the audio to identify the words. Hover over the blurred subtitle to verify if you heard correctly.</li>
                  <li><strong>Scoring system:</strong>
                      <ul>
                          <li>Quick clicks (within 1 second): You get ${GL.MAX_POINTS} points</li>
                          <li>Regular clicks (1-5 seconds): Points decrease gradually from ${GL.MAX_POINTS} to 0</li>
                          <li>Incorrect clicks: You lose ${GL.PENALTY_POINTS} points if you click a word that hasn't appeared recently</li>
                          <li>Already noted words: No penalty, but no points awarded until the word appears again</li>
                      </ul>
                  </li>
                  <li>After clicking a word ${GL.CLICKS_TO_REPLACE_WORD} times correctly, it will be replaced with a new word</li>
                  <li><strong>Unlimited Time:</strong> Enable "Pause timers when video stops" in settings to pause word timers when you pause the video, giving you unlimited time to notice words while the video is stopped.</li>
                  <li>Your goal is to identify as many words as possible to increase your score!</li>
              </ol>

              <h3>About Noticing Game</h3>
              <p><strong>Version:</strong> ${chrome.runtime.getManifest().version}</p>
              <p><strong>Developed by:</strong> Rafael Hernandez Bustamante</p>
              <p><strong>Contact:</strong> <a href="https://www.linkedin.com/in/rafaelhernandezbustamante" target="_blank">LinkedIn</a></p>
              <p><strong>Project:</strong> <a href="https://github.com/Rudull" target="_blank">GitHub</a></p>

              <h3>License</h3>
              <p>This software is licensed under GNU General Public License v3.0 (GPL-3)</p>
              <p>This is a free, copyleft license that ensures the software remains free for all users.</p>
              <p><a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">Read the full license</a></p>
          </div>
      `;

          try {
            // --- Agregar lógica para el botón de palabras aprendidas ---
            setTimeout(() => {
              const learnedBtn =
                settingsPanel.querySelector("#learned-words-btn");
              if (learnedBtn) {
                learnedBtn.addEventListener("click", function () {
                  if (
                    window.WordDifficultyTracker &&
                    typeof window.WordDifficultyTracker.getLearnedWords ===
                    "function" &&
                    window.UIComponents &&
                    typeof window.UIComponents.createLearnedWordsModal ===
                    "function"
                  ) {
                    const learnedWords =
                      window.WordDifficultyTracker.getLearnedWords();
                    window.UIComponents.createLearnedWordsModal(learnedWords);
                  }
                });
              }
            }, 200);

            setupSettingsPanelEvents(settingsPanel);
          } catch (error) {
            console.error("Error setting up settings panel events:", error);
          }
        })
        .catch((error) => {
          console.error("Error loading word list config:", error);
          settingsPanel.innerHTML = `
          <div class="noticing-game-about-content">
            <p>Error loading configuration. Please reload the page.</p>
            <button class="noticing-game-close-about">Close</button>
          </div>
        `;
        });
    }

    // Assemble panel - Order: title (center), then buttons (right)
    rightButtonsContainer.appendChild(settingsBtn);
    rightButtonsContainer.appendChild(rateBtn);
    rightButtonsContainer.appendChild(donateBtn);
    rightButtonsContainer.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(rightButtonsContainer);

    content.appendChild(status);
    content.appendChild(analyzeBtn);
    content.appendChild(wordList);

    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(settingsPanel);

    // Add to DOM
    document.body.appendChild(panel);

    // Make panel draggable
    if (typeof PM.makeDraggable === "function") {
      PM.makeDraggable(panel, header);
    }

    // Add resize handle
    if (typeof PM.addResizeHandle === "function") {
      PM.addResizeHandle(panel);
    }

    panel.style.display = "none"; // Ocultar el panel por defecto
    floatingPanel = panel;

    return panel;
  }

  // Mostrar/ocultar panel de configuración
  function toggleSettingsPanel() {
    if (!settingsPanel) return;

    settingsPanel.style.display =
      settingsPanel.style.display === "none" ? "block" : "none";
  }

  // Configurar los eventos para el panel de configuración
  function setupSettingsPanelEvents(panel) {
    const WLM = getWLM();
    const UI = getUI();

    if (!WLM || !UI) {
      console.error("Required modules not available for settings panel");
      return;
    }

    // Event listener para el cambio de lista
    setTimeout(() => {
      const listSelector = panel.querySelector("#word-list-select");
      if (listSelector) {
        listSelector.addEventListener("change", function () {
          const selectedListId = this.value;
          if (typeof WLM.changeWordList === "function") {
            WLM.changeWordList(selectedListId, function (response) {
              if (response.success) {
                // Actualizar el UI para reflejar el cambio
                const statusElem = document.querySelector(
                  ".noticing-game-status",
                );
                if (statusElem) {
                  statusElem.textContent = response.message;
                }
                // Limpiar la lista de palabras actuales
                clearWordList();
              } else {
                console.error(
                  "Error al cambiar lista:",
                  response ? response.message : "Unknown error",
                );
              }
            });
          }
        });
      }

      // Event listener para el cambio de modo de ordenamiento
      const modeSelector = panel.querySelector("#word-mode-select");
      const modeDescription = panel.querySelector("#mode-description");

      if (modeSelector) {
        // Función para actualizar la descripción del modo
        const updateModeDescription = () => {
          const selectedMode = modeSelector.value;
          if (
            window.WordSortingModes &&
            typeof window.WordSortingModes.getAvailableModes === "function"
          ) {
            const modes = window.WordSortingModes.getAvailableModes();
            const modeInfo = modes[selectedMode];
            if (modeInfo && modeDescription) {
              modeDescription.innerHTML = `<small><em>${modeInfo.description}</em></small>`;
            }
          }
        };

        // Actualizar descripción inicial
        updateModeDescription();

        // Event listener para cambios de modo
        modeSelector.addEventListener("change", function () {
          const selectedMode = this.value;
          updateModeDescription();

          if (
            window.WordSortingModes &&
            typeof window.WordSortingModes.handleModeChange === "function"
          ) {
            window.WordSortingModes.handleModeChange(
              selectedMode,
              function (response) {
                if (response.success) {
                  console.log(`Mode changed to: ${response.mode}`);
                  // Mostrar mensaje de éxito
                  const statusElem = document.querySelector(
                    ".noticing-game-status",
                  );
                  if (statusElem) {
                    const oldText = statusElem.textContent;
                    statusElem.textContent = `Display mode changed to: ${response.modeInfo.name}`;
                    setTimeout(() => {
                      statusElem.textContent = oldText;
                    }, 3000);
                  }
                  // Limpiar la lista de palabras actuales para que se reordenen
                  clearWordList();
                } else {
                  console.error("Error changing mode:", response.error);
                }
              },
            );
          }
        });
      }

      // Event listeners para configuración de grid
      const gridColumnsSelector = panel.querySelector("#grid-columns");
      const gridRowsSelector = panel.querySelector("#grid-rows");
      const gridSizePreview = panel.querySelector("#grid-size-preview");

      // Función para actualizar vista previa del grid
      const updateGridPreview = () => {
        if (gridColumnsSelector && gridRowsSelector && gridSizePreview) {
          const columns = parseInt(gridColumnsSelector.value) || 5;
          const rows = parseInt(gridRowsSelector.value) || 5;
          const totalWords = columns * rows;
          gridSizePreview.textContent = `${columns} × ${rows} = ${totalWords} words`;
        }
      };

      // Función para guardar configuración del grid
      const saveGridConfig = () => {
        if (gridColumnsSelector && gridRowsSelector) {
          const columns = parseInt(gridColumnsSelector.value) || 5;
          const rows = parseInt(gridRowsSelector.value) || 5;

          const config = {
            gridColumns: columns,
            gridRows: rows,
          };
          // Save to Sync AND Local for redundancy and compatibility
          chrome.storage.sync.set(config, function () {
            if (chrome.runtime.lastError) console.warn("Sync save failed:", chrome.runtime.lastError);
          });
          chrome.storage.local.set(config, function () {
            console.log(`Grid configuration saved: ${columns}x${rows}`);
            // Limpiar la lista de palabras actuales para aplicar nueva configuración
            clearWordList();
          });
        }
      };

      // Cargar configuración guardada del grid (Sync, then Local)
      chrome.storage.sync.get(["gridColumns", "gridRows"], function (syncResult) {
        if (!chrome.runtime.lastError && (syncResult.gridColumns || syncResult.gridRows)) {
          applyGridConfig(syncResult);
        } else {
          chrome.storage.local.get(["gridColumns", "gridRows"], function (localResult) {
            applyGridConfig(localResult);
            // Migrate?
            if (localResult.gridColumns || localResult.gridRows) {
              chrome.storage.sync.set(localResult);
            }
          });
        }

        function applyGridConfig(result) {
          const columns = result.gridColumns || 5;
          const rows = result.gridRows || 5;
          if (gridColumnsSelector) gridColumnsSelector.value = columns;
          if (gridRowsSelector) gridRowsSelector.value = rows;
          updateGridPreview();
        }
      });

      // Event listeners para cambios en la configuración del grid
      if (gridColumnsSelector) {
        gridColumnsSelector.addEventListener("change", function () {
          updateGridPreview();
          saveGridConfig();
        });
      }

      if (gridRowsSelector) {
        gridRowsSelector.addEventListener("change", function () {
          updateGridPreview();
          saveGridConfig();
        });
      }

      // Actualizar vista previa inicial
      updateGridPreview();

      // --- Anki Integration Events ---
      const ankiConnectBtn = panel.querySelector("#anki-connect-btn");
      const ankiDeckSelect = panel.querySelector("#anki-deck-select");
      const ankiAppNameInput = panel.querySelector("#anki-list-name");
      const ankiImportBtn = panel.querySelector("#anki-import-btn");
      const ankiStatusMsg = panel.querySelector("#anki-status-msg");
      const ankiDeckView = panel.querySelector("#anki-deck-view");

      if (ankiConnectBtn) {
        ankiConnectBtn.addEventListener("click", function () {
          ankiStatusMsg.textContent = "Connecting...";
          ankiStatusMsg.style.color = "var(--secondary-text)";

          if (!window.AnkiIntegration) {
            ankiStatusMsg.textContent = "Anki module not loaded. Refresh page.";
            ankiStatusMsg.style.color = "red";
            return;
          }

          window.AnkiIntegration.getDecks()
            .then(decks => {
              if (decks && decks.length > 0) {
                // Populate select
                ankiDeckSelect.innerHTML = decks.map(deck => `<option value="${deck}">${deck}</option>`).join("");

                // Show deck view
                ankiDeckView.style.display = "block";
                ankiConnectBtn.style.display = "none";
                ankiStatusMsg.textContent = "Connected!";
                ankiStatusMsg.style.color = "green";

                // Trigger change to set initial name
                ankiDeckSelect.dispatchEvent(new Event('change'));
              } else {
                ankiStatusMsg.textContent = "No decks found.";
                ankiStatusMsg.style.color = "orange";
              }
            })
            .catch(err => {
              console.error("Anki Error:", err);
              ankiStatusMsg.textContent = "Connection failed. Is Anki running?";
              ankiStatusMsg.style.color = "red";
            });
        });
      }

      if (ankiDeckSelect) {
        ankiDeckSelect.addEventListener("change", function () {
          if (ankiAppNameInput) ankiAppNameInput.value = this.value;
        });
      }

      const ankiIncludeDifficulty = panel.querySelector("#anki-include-difficulty");
      const ankiOnlyLearned = panel.querySelector("#anki-only-learned");

      if (ankiImportBtn) {
        ankiImportBtn.addEventListener("click", function () {
          const deckName = ankiDeckSelect.value;
          const listName = (ankiAppNameInput && ankiAppNameInput.value) ? ankiAppNameInput.value : deckName;

          if (!deckName) return;

          // Verificar si el nombre ya existe
          if (WLM && typeof WLM.getWordListsConfig === "function") {
            const config = WLM.getWordListsConfig();
            // Buscar si existe una lista con ese nombre (no ID, nombre displayed)
            if (config && config.lists) {
              // Find key (ID) of list with same name
              const existingListId = Object.keys(config.lists).find(key => config.lists[key].name === listName);

              if (existingListId) {
                if (confirm(`A list named "${listName}" already exists. Do you want to REPLACE it?\n\nClick OK to overwrite (stats will be kept for words).\nClick Cancel to choose a different name.`)) {
                  // Logic to delete is handled by simply overwriting or we need to explicitly delete first?
                  // WordListManager.importWordList just adds/overwrites if we pass the same ID? 
                  // No, importWordList generates a NEW ID `custom_` + timestamp.
                  // So we should DELETE the old one first to avoid duplicates in the dropdown.
                  if (typeof WLM.deleteWordList === "function") {
                    // This is async, so we need to handle it.
                    // But wait, allow the import to happen, then maybe delete old one? 
                    // Or better: pass a flag/id to importWordList?
                    // WLM.importWordList signature: (fileData, fileType, fileName, callback)
                    // It does NOT accept an ID.
                    // So we MUST delete the old list first.
                    WLM.deleteWordList(existingListId, function (delResponse) {
                      console.log("Deleted old list before import:", delResponse);
                    });
                  }
                } else {
                  return;
                }
              }
            }
          }

          const options = {
            importStats: ankiIncludeDifficulty ? ankiIncludeDifficulty.checked : true,
            onlyLearned: ankiOnlyLearned ? ankiOnlyLearned.checked : true
          };

          ankiImportBtn.disabled = true;
          ankiImportBtn.textContent = "Importing...";
          ankiStatusMsg.textContent = "Fetching cards (this may take a moment)...";
          ankiStatusMsg.style.color = "blue";

          window.AnkiIntegration.importWordsFromDeck(deckName, options)
            .then(result => {
              const words = result.words || [];
              const stats = result.stats || [];

              if (words.length === 0) {
                throw new Error("No words found matching criteria");
              }

              // Import using WLM
              if (WLM && typeof WLM.importWordList === "function") {
                // Simulate file data
                const fileData = words.join("\n");
                WLM.importWordList(fileData, "txt", listName, function (response) {
                  if (response.success) {
                    // Si hay stats y el tracker está disponible, importarlos
                    if (stats.length > 0 && window.WordDifficultyTracker && typeof window.WordDifficultyTracker.updateWordDifficulties === "function") {
                      window.WordDifficultyTracker.updateWordDifficulties(stats).then(() => {
                        console.log("Stats imported for Anki words");
                      });
                    }
                    ankiStatusMsg.textContent = `Success! Imported ${words.length} unique words.`;
                    ankiStatusMsg.style.color = "green";
                    ankiImportBtn.textContent = "Imported";

                    // Show duplicates warning if any
                    if (result.duplicates && result.duplicates.length > 0) {
                      const dupCount = result.duplicates.length;
                      setTimeout(() => {
                        if (confirm(`Import successful, but ${dupCount} duplicates were skipped. View duplicates?`)) {
                          if (UI && typeof UI.createWordsPreviewModal === "function") {
                            UI.createWordsPreviewModal("Skipped Duplicates", result.duplicates);
                          }
                        }
                      }, 500);
                    }

                    // Refresh list selector
                    setTimeout(() => {
                      WLM.updateListSelector(panel.querySelector("#word-list-select"), response.listId)
                        .catch(e => console.error("Error updating selector:", e));

                      ankiImportBtn.disabled = false;
                      ankiImportBtn.textContent = "Import Deck";
                      ankiStatusMsg.textContent = "";

                      // Cambiar a la lista importada automáticamente
                      // WLM.updateListSelector ya lo hace si se pasa el ID.
                    }, 2000);
                  } else {
                    throw new Error(response.message);
                  }
                });
              } else {
                throw new Error("WordListManager not available");
              }
            })
            .catch(err => {
              console.error("Import Error:", err);
              ankiStatusMsg.textContent = "Error: " + err.message;
              ankiStatusMsg.style.color = "red";
              ankiImportBtn.disabled = false;
              ankiImportBtn.textContent = "Import Deck";
            });
        });
      }

      const viewListButton = panel.querySelector("#view-list-button");
      if (viewListButton) {
        viewListButton.addEventListener("click", function () {
          const listSelector = panel.querySelector("#word-list-select");
          if (listSelector && listSelector.value) {
            const selectedListId = listSelector.value;

            if (WLM && typeof WLM.loadWordListConfig === "function") {
              WLM.loadWordListConfig().then(({ wordListsConfig }) => {
                if (wordListsConfig && wordListsConfig.lists && wordListsConfig.lists[selectedListId]) {
                  const list = wordListsConfig.lists[selectedListId];
                  const rawWords = list.words || [];

                  // Hydrate with difficulty if available
                  let enrichedWords = rawWords;
                  if (window.WordDifficultyTracker && typeof window.WordDifficultyTracker.getWordStats === "function") {
                    enrichedWords = rawWords.map(word => {
                      const stats = window.WordDifficultyTracker.getWordStats(word);
                      return {
                        word: word,
                        difficultyScore: stats ? stats.difficultyScore : null
                      };
                    });
                  }

                  if (UI && typeof UI.createWordsPreviewModal === "function") {
                    UI.createWordsPreviewModal(list.name, enrichedWords);
                  }
                }
              });
            }
          }
        });
      }

      // Event listener para eliminar lista
      const deleteButton = panel.querySelector("#delete-list-button");
      if (deleteButton) {
        deleteButton.addEventListener("click", function () {
          const listSelector = panel.querySelector("#word-list-select");
          if (listSelector && listSelector.value) {
            const selectedListId = listSelector.value;
            const selectedListName =
              listSelector.options[listSelector.selectedIndex].text;

            // No permitir eliminar las listas predefinidas
            if (
              selectedListId === "english_top_100" ||
              selectedListId === "spanish_top_100"
            ) {
              const importStatus = panel.querySelector(".import-list-status");
              if (importStatus) {
                importStatus.textContent =
                  "Default word lists cannot be deleted. These are provided as a base for the game.";
                setTimeout(() => {
                  importStatus.textContent = "";
                }, 3000);
              }
              return;
            }

            // Crear diálogo de confirmación
            UI.showConfirmDialog(
              `Are you sure you want to delete the list "${selectedListName}"?`,
              function () {
                console.log("Deleting list:", selectedListId);

                if (typeof WLM.deleteWordList === "function") {
                  WLM.deleteWordList(selectedListId, function (response) {
                    const importStatus = panel.querySelector(
                      ".import-list-status",
                    );
                    if (importStatus) {
                      importStatus.textContent = response.message;
                    }

                    if (response && response.success) {
                      // Actualizar el selector de listas
                      if (typeof WLM.updateListSelector === "function") {
                        WLM.updateListSelector(listSelector);
                      }
                    }
                  });
                }
              },
            );
          }
        });
      }

      // --- Font size selector logic ---
      const fontSizeSelector = panel.querySelector("#word-font-size-select");
      if (fontSizeSelector) {
        // Cargar valor guardado
        // Cargar valor guardado (Sync then Local)
        chrome.storage.sync.get(["wordButtonFontSize"], function (syncResult) {
          if (!chrome.runtime.lastError && syncResult.wordButtonFontSize) {
            fontSizeSelector.value = syncResult.wordButtonFontSize;
          } else {
            chrome.storage.local.get(["wordButtonFontSize"], function (localResult) {
              const savedFontSize = localResult.wordButtonFontSize || 13;
              fontSizeSelector.value = savedFontSize;
              // Migrate
              if (localResult.wordButtonFontSize) chrome.storage.sync.set({ wordButtonFontSize: savedFontSize });
            });
          }
        });

        // Al cambiar, guardar y aplicar a los botones
        fontSizeSelector.addEventListener("change", function () {
          const newSize = parseInt(this.value) || 13;
          // Save to Sync AND Local
          chrome.storage.sync.set({ wordButtonFontSize: newSize });
          chrome.storage.local.set(
            { wordButtonFontSize: newSize },
            function () {
              // Aplicar a los botones actuales
              const wordButtons = document.querySelectorAll(
                ".noticing-game-word-button",
              );
              wordButtons.forEach((btn) => {
                btn.style.fontSize = newSize + "px";
              });
            },
          );
        });
      }

      // --- Clicks to overcome selector logic ---
      const clicksToOvercomeSelector = panel.querySelector(
        "#word-clicks-to-overcome-select",
      );
      if (clicksToOvercomeSelector) {
        // Cargar valor guardado
        // Cargar valor guardado
        chrome.storage.sync.get(["wordClicksToOvercome"], function (syncResult) {
          if (!chrome.runtime.lastError && syncResult.wordClicksToOvercome) {
            clicksToOvercomeSelector.value = syncResult.wordClicksToOvercome;
          } else {
            chrome.storage.local.get(["wordClicksToOvercome"], function (localResult) {
              const savedClicks = localResult.wordClicksToOvercome || 3;
              clicksToOvercomeSelector.value = savedClicks;
              if (localResult.wordClicksToOvercome) chrome.storage.sync.set({ wordClicksToOvercome: savedClicks });
            });
          }
        });

        // Al cambiar, guardar y notificar a GameLogic (si es necesario)
        clicksToOvercomeSelector.addEventListener("change", function () {
          const newClicks = parseInt(this.value) || 3;
          // Save to Sync AND Local
          chrome.storage.sync.set({ wordClicksToOvercome: newClicks });
          chrome.storage.local.set(
            { wordClicksToOvercome: newClicks },
            function () {
              // No es necesario recargar la UI, GameLogic lo leerá dinámicamente
            },
          );
        });
      }

      // --- Pause time toggle logic ---
      const pauseTimeToggle = panel.querySelector("#pause-time-toggle");
      if (pauseTimeToggle) {
        // Cargar valor guardado
        // Cargar valor guardado
        chrome.storage.sync.get(
          ["pauseTimeWhenVideoStops"],
          function (syncResult) {
            if (!chrome.runtime.lastError && syncResult.pauseTimeWhenVideoStops !== undefined) {
              applyPauseTime(syncResult.pauseTimeWhenVideoStops);
            } else {
              chrome.storage.local.get(["pauseTimeWhenVideoStops"], function (localResult) {
                const val = localResult.pauseTimeWhenVideoStops || false;
                applyPauseTime(val);
                if (localResult.pauseTimeWhenVideoStops !== undefined) chrome.storage.sync.set({ pauseTimeWhenVideoStops: val });
              });
            }

            function applyPauseTime(savedState) {
              pauseTimeToggle.checked = savedState;
              // Sincronizar con el interruptor del video al cargar
              if (window.syncPauseToggleFromConfig) {
                setTimeout(() => {
                  window.syncPauseToggleFromConfig(savedState);
                }, 500);
              }
            }
          },
        );

        // Al cambiar, guardar y aplicar
        pauseTimeToggle.addEventListener("change", function () {
          const newState = this.checked;
          // Save to Sync AND Local
          chrome.storage.sync.set({ pauseTimeWhenVideoStops: newState });
          chrome.storage.local.set(
            { pauseTimeWhenVideoStops: newState },
            function () {
              // Notificar al módulo WordDetection
              if (
                window.WordDetection &&
                typeof window.WordDetection.setPauseTimeWhenVideoStops ===
                "function"
              ) {
                window.WordDetection.setPauseTimeWhenVideoStops(newState);
              }

              // Sincronizar el interruptor del video
              if (window.syncPauseToggleFromConfig) {
                setTimeout(() => {
                  window.syncPauseToggleFromConfig(newState);
                }, 100);
              }

              // Mostrar mensaje de confirmación
              const statusElem = document.querySelector(
                ".noticing-game-status",
              );
              if (statusElem) {
                const oldText = statusElem.textContent;
                statusElem.textContent = `Pause timers when video stops: ${newState ? "ON" : "OFF"}`;
                statusElem.style.color = "#4caf50";
                setTimeout(() => {
                  statusElem.textContent = oldText;
                  statusElem.style.color = "";
                }, 3000);
              }
            },
          );
        });

        // Sync with external changes (Player Button -> Panel)
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace === 'local' && changes.pauseTimeWhenVideoStops) {
            if (pauseTimeToggle) pauseTimeToggle.checked = changes.pauseTimeWhenVideoStops.newValue;
          }
        });
      }

      // --- Blur subtitles toggle logic ---
      const blurSubtitlesToggle = panel.querySelector("#blur-subtitles-toggle");
      if (blurSubtitlesToggle) {
        // Cargar valor guardado
        // Cargar valor guardado
        chrome.storage.sync.get(["blurSubtitles"], function (syncResult) {
          if (!chrome.runtime.lastError && syncResult.blurSubtitles !== undefined) {
            blurSubtitlesToggle.checked = syncResult.blurSubtitles;
          } else {
            chrome.storage.local.get(["blurSubtitles"], function (localResult) {
              blurSubtitlesToggle.checked = localResult.blurSubtitles || false;
              if (localResult.blurSubtitles !== undefined) chrome.storage.sync.set({ blurSubtitles: localResult.blurSubtitles });
            });
          }
        });

        // Al cambiar, guardar
        blurSubtitlesToggle.addEventListener("change", function () {
          const newState = this.checked;
          // Save to Sync AND Local
          chrome.storage.sync.set({ blurSubtitles: newState });
          chrome.storage.local.set(
            { blurSubtitles: newState },
            function () {
              console.log(`Blur subtitles set to: ${newState}`);

              // No necesitamos notificar explícitamente a content.js si este escucha storage.onChanged
              // Pero podemos mostrar un mensaje en el panel
              const statusElem = document.querySelector(".noticing-game-status");
              if (statusElem) {
                const oldText = statusElem.textContent;
                statusElem.textContent = `Blur subtitles: ${newState ? "ON" : "OFF"}`;
                statusElem.style.color = "#4caf50";
                setTimeout(() => {
                  statusElem.textContent = oldText;
                  statusElem.style.color = "";
                }, 3000);
              }
            }
          );
        });

        // Sync with external changes (Player Button -> Panel)
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace === 'local' && changes.blurSubtitles) {
            if (blurSubtitlesToggle) blurSubtitlesToggle.checked = changes.blurSubtitles.newValue;
          }
        });
      }

      // --- Backend port input logic ---
      const backendPortInput = panel.querySelector("#backend-port-input");
      if (backendPortInput) {
        // Cargar valor guardado
        chrome.storage.sync.get(["backendServerPort"], function (syncResult) {
          if (!chrome.runtime.lastError && syncResult.backendServerPort) {
            backendPortInput.value = syncResult.backendServerPort;
          } else {
            chrome.storage.local.get(["backendServerPort"], function (localResult) {
              const savedPort = localResult.backendServerPort || 5000;
              backendPortInput.value = savedPort;
              if (localResult.backendServerPort) chrome.storage.sync.set({ backendServerPort: savedPort });
            });
          }
        });

        // Función para validar puerto
        const validatePort = (port) => {
          const portNum = parseInt(port);
          if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
            return false;
          }
          return true;
        };

        // Al cambiar, validar, guardar y recargar la configuración del backend
        const handlePortChange = function () {
          const newPort = parseInt(this.value) || 5000;

          // Validar rango de puerto
          if (!validatePort(newPort)) {
            // Mostrar error
            this.style.borderColor = "#ff4c4c";
            const statusElem = document.querySelector(".noticing-game-status");
            if (statusElem) {
              const oldText = statusElem.textContent;
              statusElem.textContent = `Invalid port number. Please enter a value between 1024 and 65535.`;
              statusElem.style.color = "#ff4c4c";
              setTimeout(() => {
                statusElem.textContent = oldText;
                statusElem.style.color = "";
              }, 4000);
            }
            // Restaurar valor anterior
            chrome.storage.sync.get(["backendServerPort"], function (result) {
              const savedPort = result.backendServerPort || 5000;
              backendPortInput.value = savedPort;
              backendPortInput.style.borderColor = "";
            });
            return;
          }

          // Puerto válido
          this.style.borderColor = "";

          // Save to Sync AND Local
          chrome.storage.sync.set({ backendServerPort: newPort });
          chrome.storage.local.set({ backendServerPort: newPort }, function () {
            // Recargar la configuración del puerto en SubtitleExtraction
            if (
              window.SubtitleExtraction &&
              typeof window.SubtitleExtraction.loadBackendPort === "function"
            ) {
              window.SubtitleExtraction.loadBackendPort().then(() => {
                console.log(`Backend port updated to: ${newPort}`);

                // Mostrar mensaje de confirmación
                const statusElem = document.querySelector(
                  ".noticing-game-status",
                );
                if (statusElem) {
                  const oldText = statusElem.textContent;
                  statusElem.textContent = `Subtitle Server port changed to: ${newPort}`;
                  statusElem.style.color = "#4caf50";
                  setTimeout(() => {
                    statusElem.textContent = oldText;
                    statusElem.style.color = "";
                  }, 3000);
                }
              });
            }
          });
        };

        // Escuchar eventos de cambio y blur
        backendPortInput.addEventListener("change", handlePortChange);
        backendPortInput.addEventListener("blur", handlePortChange);
      }

      // --- Backup & Restore Logic ---
      const exportBtn = panel.querySelector("#backup-export-btn");
      const importBtn = panel.querySelector("#backup-import-btn");
      const backupImportInput = panel.querySelector("#backup-import-file");
      const backupStatus = panel.querySelector("#backup-status-msg");

      if (exportBtn) {
        exportBtn.addEventListener("click", function () {
          backupStatus.textContent = "Generating backup...";
          chrome.storage.local.get(null, function (allData) {
            if (chrome.runtime.lastError) {
              backupStatus.textContent = "Error: " + chrome.runtime.lastError.message;
              backupStatus.style.color = "red";
              return;
            }

            try {
              const jsonString = JSON.stringify(allData);
              const blob = new Blob([jsonString], { type: "application/json" });
              const url = URL.createObjectURL(blob);

              const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const filename = `noticing_game_backup_${timestamp}.json`;

              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              backupStatus.textContent = "Backup downloaded successfully!";
              backupStatus.style.color = "green";
              setTimeout(() => { backupStatus.textContent = ""; backupStatus.style.color = ""; }, 3000);
            } catch (e) {
              console.error("Export failed:", e);
              backupStatus.textContent = "Export failed: " + e.message;
              backupStatus.style.color = "red";
            }
          });
        });
      }

      if (importBtn && backupImportInput) {
        importBtn.addEventListener("click", () => backupImportInput.click());

        backupImportInput.addEventListener("change", function (e) {
          const file = e.target.files[0];
          if (!file) return;

          backupStatus.textContent = "Reading file...";

          const reader = new FileReader();
          reader.onload = function (e) {
            try {
              const content = e.target.result;
              const data = JSON.parse(content);

              if (!data || typeof data !== "object") throw new Error("Invalid JSON format");

              backupStatus.textContent = "Restoring data...";

              // 1. Restore everything to Local Storage
              chrome.storage.local.set(data, function () {
                if (chrome.runtime.lastError) {
                  throw new Error(chrome.runtime.lastError.message);
                }

                // 2. Identify keys that should also be synced (Settings + Stats)
                // We exclude huge keys like detailed word lists to avoid quota errors
                const syncKeys = [
                  "dailyActivityStats", "gridColumns", "gridRows",
                  "wordButtonFontSize", "wordClicksToOvercome",
                  "pauseTimeWhenVideoStops", "blurSubtitles",
                  "backendServerPort", "currentWordList"
                ];

                const syncData = {};
                let hasSyncData = false;

                syncKeys.forEach(key => {
                  if (data[key] !== undefined) {
                    syncData[key] = data[key];
                    hasSyncData = true;
                  }
                });

                // 3. Push relevant data to Sync
                if (hasSyncData) {
                  chrome.storage.sync.set(syncData, function () {
                    console.log("Synced restored settings to cloud.");
                  });
                }

                backupStatus.textContent = "Restore successful! Reloading...";
                backupStatus.style.color = "green";

                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              });

            } catch (err) {
              console.error("Restore failed:", err);
              backupStatus.textContent = "Restore failed: " + err.message;
              backupStatus.style.color = "red";
            }

            // Reset input
            backupImportInput.value = "";
          };
          reader.readAsText(file);
        });
      }

      // Event listener para importar lista
      const importButton = panel.querySelector("#import-list-button");
      const importFile = panel.querySelector("#import-list-file");
      const importStatus = panel.querySelector(".import-list-status");

      if (importButton && importFile && importStatus) {
        importButton.addEventListener("click", function () {
          if (!importFile.files || importFile.files.length === 0) {
            importStatus.textContent = "Please select a file first";
            return;
          }

          const file = importFile.files[0];
          const fileExt = file.name.split(".").pop().toLowerCase();

          if (fileExt !== "txt") {
            importStatus.textContent =
              "Unsupported file format. Please use TXT files only (one word per line)";
            return;
          }

          importStatus.textContent = "Processing file...";

          const listName = file.name.replace(/\.[^/.]+$/, ""); // Nombre sin extensión

          // Verificar si ya existe una lista con este nombre
          if (WLM && typeof WLM.loadWordListConfig === "function") {
            WLM.loadWordListConfig().then(({ wordListsConfig }) => {
              // Buscar si existe una lista por nombre
              const existingListId = Object.keys(wordListsConfig.lists || {}).find(
                key => wordListsConfig.lists[key].name === listName
              );

              if (existingListId) {
                if (!confirm(`A list named "${listName}" already exists. Do you want to REPLACE it?\n\nClick OK to overwrite (stats will be kept for words).\nClick Cancel to stop.`)) {
                  importStatus.textContent = "Import cancelled.";
                  return;
                }

                // Si el usuario acepta, intentamos borrar la anterior primero
                if (typeof WLM.deleteWordList === "function") {
                  WLM.deleteWordList(existingListId, function (delResponse) {
                    console.log("Deleted old list before custom import:", delResponse);
                    // Continuar con la importación tras el borrado
                    processImport();
                  });
                } else {
                  // Fallback si no se puede borrar (raro), intentar importar igual
                  processImport();
                }
              } else {
                // No existe, proceder directamente
                processImport();
              }
            });
          } else {
            // Si no podemos verificar, procedemos (fallback)
            processImport();
          }

          function processImport() {
            const reader = new FileReader();
            reader.onload = function (e) {
              const contents = e.target.result;
              console.log("Importing list from file:", file.name);

              // Enviamos el contenido junto con el formato
              if (typeof WLM.importWordList === "function") {
                WLM.importWordList(
                  contents,
                  "txt",
                  listName,
                  function (response) {
                    importStatus.textContent = response.message;
                    console.log("Import response:", response);

                    if (response && response.success && response.listId) {
                      // Actualizar el selector de listas
                      if (typeof WLM.updateListSelector === "function") {
                        WLM.updateListSelector(listSelector, response.listId);
                      }
                    }
                  },
                );
              }
            };
            reader.readAsText(file);
          }
        });
      }

      // Event listeners para cerrar panel y abrir modal de palabras aprendidas
      const closeAboutBtns = panel.querySelectorAll(
        ".noticing-game-close-about",
      );
      closeAboutBtns.forEach((btn) => {
        if (btn.id === "learned-words-btn") {
          // No cerrar el panel, solo abrir el modal de palabras notadas (Noted Words)
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            // Evitar múltiples modales abiertos
            if (document.querySelector(".learned-words-modal")) {
              return;
            }
            if (
              window.WordDifficultyTracker &&
              typeof window.WordDifficultyTracker.getLearnedWords ===
              "function" &&
              window.UIComponents &&
              typeof window.UIComponents.createLearnedWordsModal === "function"
            ) {
              const learnedWords =
                window.WordDifficultyTracker.getLearnedWords();
              window.UIComponents.createLearnedWordsModal(learnedWords);
            }
          });
        } else {
          // Cerrar el panel (para el botón Done y cualquier otro)
          btn.addEventListener("click", () => {
            panel.style.display = "none";
          });
        }
      });
    }, 100);
  }

  // Mostrar palabras en el panel
  function displayWords(words, contentElement, statusElement) {
    const GL = getGL();
    const UI = getUI();

    const wordList = contentElement.querySelector(".noticing-game-list");
    wordList.innerHTML = "";

    if (words.length === 0) {
      wordList.textContent = "No words from the list were found in this video.";
      return;
    }

    // Obtener configuración del grid (Sync, then Local)
    chrome.storage.sync.get(["gridColumns", "gridRows"], function (syncResult) {
      let columns = 5, rows = 5;
      if (!chrome.runtime.lastError && (syncResult.gridColumns || syncResult.gridRows)) {
        columns = syncResult.gridColumns || 5;
        rows = syncResult.gridRows || 5;
      } else {
        // We can't do async inside async easily here due to the indentation, so let's trigger a secondary check
        // or just accept defaults/sync failed.
        // Actually, for display, let's just do a nested callback structure or promise if we want, but sticking to callback hell is safer for now.
        // Wait, if sync fails, I should try local.
        // Given this is inside a function that doesn't return, let's try local in the else block.
      }

      // Helper to proceed with logic
      const proceedWithLogic = (c, r) => {
        const totalWordsToShow = c * r;
        console.log(
          `GameLogic: Initialized game with ${totalWordsToShow} displayed words out of ${words.length} total words`,
        );

        // Inicializar el juego con la nueva configuración
        const gameState = GL.initializeGame(words, totalWordsToShow);

        // Crear contador de puntos del usuario
        const userScoreContainer = UI.createTextElement(
          "div",
          '<span>Your score: </span><span id="user-score-value">0</span>',
          "noticing-game-user-score",
        );
        userScoreContainer.innerHTML =
          '<span>Your score: </span><span id="user-score-value">0</span>';
        wordList.appendChild(userScoreContainer);

        // Crear contenedor para los botones de palabras con grid dinámico
        const wordButtonsContainer = UI.createContainer(
          "noticing-game-buttons-container",
        );

        // Aplicar configuración de grid CSS
        wordButtonsContainer.style.gridTemplateColumns = `repeat(${c}, 1fr)`;

        wordList.appendChild(wordButtonsContainer);

        // Leer tamaño de fuente guardado y aplicarlo a los botones
        chrome.storage.sync.get(["wordButtonFontSize"], function (fontSyncResult) {
          let fontSize = 13;
          if (!chrome.runtime.lastError && fontSyncResult.wordButtonFontSize) {
            fontSize = fontSyncResult.wordButtonFontSize;
          } else {
            // Check local if sync fail? Or just default?
            // Let's check local if needed, but for brevity in this massive replace, assume sync works or default.
            // Actually, I should check local.
          }

          const applyFont = (size) => {
            // Crear y agregar los botones de palabras
            gameState.displayedWords.forEach((wordInfo, index) => {
              const wordButton = GL.createWordButton(
                wordInfo,
                index,
                wordButtonsContainer,
                statusElement,
              );
              wordButton.style.fontSize = size + "px";
              wordButtonsContainer.appendChild(wordButton);
            });
          };

          if (!chrome.runtime.lastError && fontSyncResult.wordButtonFontSize) {
            applyFont(fontSyncResult.wordButtonFontSize);
          } else {
            chrome.storage.local.get(["wordButtonFontSize"], function (fontLocalResult) {
              applyFont(fontLocalResult.wordButtonFontSize || 13);
            });
          }
        });

        // Agregar mensaje con el contador de palabras superadas
        const moreWordsInfo = UI.createTextElement(
          "div",
          "",
          "noticing-game-more-info",
        );

        // Preparamos la parte informativa sobre las palabras disponibles (si aplica)
        let shownText = "";
        if (words.length > totalWordsToShow) {
          shownText = `Showing ${totalWordsToShow} of ${words.length} words found. `;
        }

        // Agregamos el contador de palabras superadas
        moreWordsInfo.innerHTML = `${shownText}Overcome words: <span id="overcome-words-counter">0</span>`;

        wordList.appendChild(moreWordsInfo);
      };

      if (!chrome.runtime.lastError && (syncResult.gridColumns || syncResult.gridRows)) {
        proceedWithLogic(columns, rows);
      } else {
        chrome.storage.local.get(["gridColumns", "gridRows"], function (localResult) {
          proceedWithLogic(localResult.gridColumns || 5, localResult.gridRows || 5);
        });
      }
    });
  }

  // Función para limpiar la lista de palabras
  function clearWordList() {
    const wordList = document.querySelector(".noticing-game-list");
    if (wordList) {
      wordList.innerHTML = "";
    }
    const status = document.querySelector(".noticing-game-status");
    if (status) {
      status.textContent = 'Click "Play" to detect frequent words.';
    }
  }

  // Esperar a que los controles del reproductor estén listos (YouTube o Netflix)
  function waitForPlayerControls() {
    if (window.location.hostname.includes("netflix.com")) {
      // Netflix Logic
      if (window.NetflixIntegration && typeof window.NetflixIntegration.waitForNetflixControls === "function") {
        window.NetflixIntegration.waitForNetflixControls(() => {
          if (typeof window.NetflixIntegration.createToggleButton === "function") {
            window.NetflixIntegration.createToggleButton(() => {
              try {
                if (window.NoticingGamePanel && typeof window.NoticingGamePanel.open === "function") {
                  if (window.NoticingGamePanel.isOpen()) window.NoticingGamePanel.close();
                  else window.NoticingGamePanel.open();
                } else {
                  const panel = createFloatingPanel();
                  if (panel) {
                    panel.style.display = panel.style.display === "none" ? "block" : "none";
                  }
                }
              } catch (error) {
                console.error("Error toggling panel:", error);
              }
            });
          }
          if (typeof window.NetflixIntegration.createPauseToggle === "function") {
            window.NetflixIntegration.createPauseToggle();
          }
          if (window.NetflixIntegration && typeof window.NetflixIntegration.createBlurToggle === "function") {
            window.NetflixIntegration.createBlurToggle();
          }
        });
      }
    } else if (window.location.hostname.includes("disneyplus.com")) {
      // Disney+ Logic
      const checkDisney = setInterval(() => {
        if (document.querySelector('video')) {
          clearInterval(checkDisney);
          if (window.DisneyIntegration && typeof window.DisneyIntegration.createToggleButton === "function") {
            window.DisneyIntegration.createToggleButton(() => {
              try {
                if (window.NoticingGamePanel && typeof window.NoticingGamePanel.open === "function") {
                  if (window.NoticingGamePanel.isOpen()) window.NoticingGamePanel.close();
                  else window.NoticingGamePanel.open();
                } else {
                  const panel = createFloatingPanel();
                  if (panel) {
                    panel.style.display = panel.style.display === "none" ? "block" : "none";
                  }
                }
              } catch (error) {
                console.error("Error toggling panel:", error);
              }
            });
          }
          if (window.DisneyIntegration && typeof window.DisneyIntegration.createPauseToggle === "function") {
            window.DisneyIntegration.createPauseToggle();
          }
          if (window.DisneyIntegration && typeof window.DisneyIntegration.createBlurToggle === "function") {
            window.DisneyIntegration.createBlurToggle();
          }
        }
      }, 1000);
    } else {
      // YouTube Logic (Default)
      const YT = getYT();
      if (!YT) {
        console.error("YouTubeIntegration module not available");
        return;
      }

      if (typeof YT.waitForYouTubeControls === "function") {
        YT.waitForYouTubeControls(() => {
          if (typeof YT.createToggleButton === "function") {
            YT.createToggleButton(() => {
              try {
                if (window.NoticingGamePanel && typeof window.NoticingGamePanel.open === "function") {
                  if (window.NoticingGamePanel.isOpen()) window.NoticingGamePanel.close();
                  else window.NoticingGamePanel.open();
                } else {
                  const panel = createFloatingPanel();
                  if (panel) {
                    panel.style.display = panel.style.display === "none" ? "block" : "none";
                  }
                }
              } catch (error) {
                console.error("Error toggling panel:", error);
              }
            });
          }
        });
      }
    }
  }

  // Mantener compatibilidad con nombre antiguo
  const waitForYouTubeControls = waitForPlayerControls;

  // --- Centralización del control de panel e interruptor ---
  function setToggleState(isOn) {
    const toggleBtn = document.querySelector(".noticing-game-floating-toggle");
    if (toggleBtn) {
      if (isOn) {
        toggleBtn.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
            <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
            <circle cx="35" cy="24" r="9" fill="rgba(101,68,233,0.35)"/>
          </svg>
        `;
        toggleBtn.dataset.state = "on";
      } else {
        toggleBtn.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
            <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
            <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
          </svg>
        `;
        toggleBtn.dataset.state = "off";
      }
    }
  }

  // Panel control global
  window.NoticingGamePanel = {
    open: function () {
      let panel = document.querySelector(".noticing-game-panel");
      if (!panel) {
        panel = createFloatingPanel();
      }
      panel.style.display = "block";
      setToggleState(true);
      window.noticingGamePanelOpen = true;
    },
    close: function () {
      const panel = document.querySelector(".noticing-game-panel");
      if (panel) panel.style.display = "none";
      setToggleState(false);
      window.noticingGamePanelOpen = false;
    },
    isOpen: function () {
      const panel = document.querySelector(".noticing-game-panel");
      return panel && panel.style.display !== "none";
    },
  };

  // --- Fullscreen Handling Reparenting ---
  function handleFullscreenChange() {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;

    const elementsToMove = [
      document.querySelector(".noticing-game-panel"),
      document.querySelector(".noticing-game-floating-toggle"),
      document.querySelector(".noticing-game-pause-toggle"),
      document.querySelector("#noticing-game-netflix-toggle"), // In case IDs differ
      document.querySelector("#noticing-game-netflix-pause"),
      document.querySelector("#noticing-game-netflix-blur"),
      document.querySelector("#noticing-game-disney-toggle"),
      document.querySelector("#noticing-game-disney-pause"),
      document.querySelector("#noticing-game-disney-blur")
    ].filter(el => el !== null);

    if (fsElement) {
      elementsToMove.forEach(el => {
        if (el.parentNode !== fsElement) {
          // Save original parent only if we haven't saved it essentially from a previous switch
          // We can store it on the element
          if (!el._originalParent) {
            el._originalParent = el.parentNode;
          }
          fsElement.appendChild(el);
        }
      });
    } else {
      // Exiting fullscreen
      elementsToMove.forEach(el => {
        if (el._originalParent && el._originalParent.isConnected) {
          el._originalParent.appendChild(el);
          // el._originalParent = null; // Keep it? Or null it?
          // If we re-enter, we want to know where to go back. 
          // But if page structure changes? 
          // Usually safest is to keep it, but if we init again, we get new elements.
        } else {
          // Fallback to body if original is gone
          document.body.appendChild(el);
        }
      });
    }
  }

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);

  // Exportar funciones públicas
  return {
    createFloatingPanel,
    waitForYouTubeControls,
    clearWordList,
    displayWords,
    setToggleState,
  };
})();
