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

                status.textContent = `Analysis completed. Found ${result.words ? result.words.length : 0} words from the list.`;

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
            status.textContent = `Error: No subtitles found!`;
            status.style.color = "red";
            status.style.fontWeight = "bold";

            // Mostrar alerta para que el usuario sepa qué hacer
            alert(
              "This video doesn't have subtitles. Please choose a video with subtitles (either auto-generated or manual) to use Noticing Game.",
            );

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
                  <div class="word-list-actions">
                      <button id="delete-list-button" class="delete-list-btn">Delete List</button>
                  </div>
              </div>

              <h3>Word Display Mode</h3>
              <p>Choose how words are ordered and displayed during the game:</p>
              <div class="noticing-game-mode-selector">
                  <label for="word-mode-select">Display mode:</label>
                  <select id="word-mode-select">
                      ${window.WordSortingModes && typeof window.WordSortingModes.createModeOptions === "function" ? window.WordSortingModes.createModeOptions() : '<option value="frequency">By Frequency (Default)</option>'}
                  </select>
                  <div class="mode-description" id="mode-description">
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
                <div class="grid-config-row">
                  <label for="word-clicks-to-overcome-select" style="font-weight: bold; color: var(--text-color);" title="How many times you must notice a word before it is considered 'overcome' and replaced by a new one.">Times to overcome a word:</label>
                  <select id="word-clicks-to-overcome-select" class="noticing-game-other-select" title="How many times you must notice a word before it is considered 'overcome' and replaced by a new one." style="margin-left: 10px;">
                    ${Array.from({ length: 6 }, (_, i) => {
                      const value = i + 1;
                      const selected = value === 3 ? "selected" : "";
                      return `<option value="${value}" ${selected}>${value}</option>`;
                    }).join("")}
                  </select>
                </div>
              </div>

              <h3>How to play:</h3>
              <ol style="padding-left: 20px;">
                  <li>First, select a word list from the dropdown or import your own custom list</li>
                  <li>Watch YouTube videos with subtitles on or off, depending on your preference.</li>
                  <li>Click "Play" to detect frequent words from your selected list</li>
                  <li>When you notice a word from the list being said in the video, quickly click it</li>
                  <li><strong>Scoring system:</strong>
                      <ul>
                          <li>Quick clicks (within 1 second): You get ${GL.MAX_POINTS} points</li>
                          <li>Regular clicks (1-5 seconds): Points decrease gradually from ${GL.MAX_POINTS} to 0</li>
                          <li>Incorrect clicks: You lose ${GL.PENALTY_POINTS} points if you click a word that hasn't appeared recently</li>
                          <li>Already noted words: No penalty, but no points awarded until the word appears again</li>
                      </ul>
                  </li>
                  <li>After clicking a word ${GL.CLICKS_TO_REPLACE_WORD} times correctly, it will be replaced with a new word</li>
                  <li>Your goal is to identify as many words as possible to increase your score!</li>
              </ol>

              <h3>About Noticing Game</h3>
              <p><strong>Version:</strong> 0.2.2</p>
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

          chrome.storage.local.set(
            {
              gridColumns: columns,
              gridRows: rows,
            },
            function () {
              console.log(`Grid configuration saved: ${columns}x${rows}`);
              // Limpiar la lista de palabras actuales para aplicar nueva configuración
              clearWordList();
            },
          );
        }
      };

      // Cargar configuración guardada del grid
      chrome.storage.local.get(["gridColumns", "gridRows"], function (result) {
        const columns = result.gridColumns || 5;
        const rows = result.gridRows || 5;

        if (gridColumnsSelector) {
          gridColumnsSelector.value = columns;
        }
        if (gridRowsSelector) {
          gridRowsSelector.value = rows;
        }
        updateGridPreview();
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
        chrome.storage.local.get(["wordButtonFontSize"], function (result) {
          const savedFontSize = result.wordButtonFontSize || 13;
          fontSizeSelector.value = savedFontSize;
        });

        // Al cambiar, guardar y aplicar a los botones
        fontSizeSelector.addEventListener("change", function () {
          const newSize = parseInt(this.value) || 13;
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
        chrome.storage.local.get(["wordClicksToOvercome"], function (result) {
          const savedClicks = result.wordClicksToOvercome || 3;
          clicksToOvercomeSelector.value = savedClicks;
        });

        // Al cambiar, guardar y notificar a GameLogic (si es necesario)
        clicksToOvercomeSelector.addEventListener("change", function () {
          const newClicks = parseInt(this.value) || 3;
          chrome.storage.local.set(
            { wordClicksToOvercome: newClicks },
            function () {
              // No es necesario recargar la UI, GameLogic lo leerá dinámicamente
            },
          );
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

          const reader = new FileReader();
          reader.onload = function (e) {
            const contents = e.target.result;
            console.log("Importing list from file:", file.name);

            // Enviamos el contenido junto con el formato
            if (typeof WLM.importWordList === "function") {
              WLM.importWordList(
                contents,
                "txt",
                file.name.replace(/\.[^/.]+$/, ""), // Nombre sin extensión
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

    // Obtener configuración del grid
    chrome.storage.local.get(["gridColumns", "gridRows"], function (result) {
      const columns = result.gridColumns || 5;
      const rows = result.gridRows || 5;
      const totalWordsToShow = columns * rows;

      console.log(
        `Displaying words with grid configuration: ${columns}x${rows} = ${totalWordsToShow} words`,
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
      wordButtonsContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

      wordList.appendChild(wordButtonsContainer);

      // Leer tamaño de fuente guardado y aplicarlo a los botones
      chrome.storage.local.get(["wordButtonFontSize"], function (fontResult) {
        const fontSize = fontResult.wordButtonFontSize || 13;

        // Crear y agregar los botones de palabras
        gameState.displayedWords.forEach((wordInfo, index) => {
          const wordButton = GL.createWordButton(
            wordInfo,
            index,
            wordButtonsContainer,
            statusElement,
          );
          wordButton.style.fontSize = fontSize + "px";
          wordButtonsContainer.appendChild(wordButton);
        });
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

  // Esperar a que la página de YouTube esté completamente cargada
  function waitForYouTubeControls() {
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
              const panel = createFloatingPanel();
              if (panel) {
                panel.style.display =
                  panel.style.display === "none" ? "block" : "none";
              }
            } catch (error) {
              console.error("Error toggling panel:", error);
            }
          });
        }
      });
    }
  }

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

  // Exportar funciones públicas
  return {
    createFloatingPanel,
    waitForYouTubeControls,
    clearWordList,
    displayWords,
    setToggleState,
  };
})();
