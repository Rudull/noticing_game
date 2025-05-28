// Gestor principal de la interfaz de usuario para Noticing Game
window.UIManager = (function () {
  // Referencias a los distintos módulos
  // Utilizamos funciones para obtener referencias actualizadas en el momento de uso
  const getUI = () => window.UIComponents;
  const getPM = () => window.PanelManager;
  const getWLM = () => window.WordListManager;
  const getGL = () => window.GameLogic;
  const getYT = () => window.YouTubeIntegration;
  const getSP = () => window.SubtitleProcessor;

  // Referencia al panel flotante
  let floatingPanel = null;
  let settingsPanel = null;

  // Crear panel flotante
  function createFloatingPanel() {
    // Verificar si ya existe
    if (document.querySelector(".noticing-game-panel")) {
      return document.querySelector(".noticing-game-panel");
    }

    const WLM = getWLM();
    const UI = getUI();
    const PM = getPM();
    const GL = getGL();

    // Asegurarnos de que tenemos los datos más recientes
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
        toggleSettingsPanel();
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

    const closeBtn = UI.createButton("noticing-game-close", "×", () => {
      panel.style.display = "none";
    });

    const content = UI.createContainer("noticing-game-content");

    const status = UI.createTextElement(
      "div",
      'Click "Play" to detect frequent words.',
      "noticing-game-status",
    );

    const analyzeBtn = UI.createButton("noticing-game-button", "Play", () => {
      const SP = getSP();
      const GL = getGL();

      // Reiniciar contador de palabras superadas
      GL.resetOvercomeTotalWords();

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
      SP.analyzeSubtitles().then((result) => {
        if (result.success) {
          status.textContent = `Analysis completed. Found ${result.words.length} words from the list.`;
          displayWords(result.words, content, status);
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
      });
    });

    const wordList = UI.createContainer("noticing-game-list");

    // Create settings/about panel (hidden by default)
    settingsPanel = document.createElement("div");
    settingsPanel.className = "noticing-game-about-panel";
    settingsPanel.style.display = "none";

    // Cargar la configuración de listas
    WLM.loadWordListConfig().then(() => {
      // Construir el contenido del panel de configuración
      settingsPanel.innerHTML = `
          <div class="noticing-game-about-content">
              <div style="text-align: right; margin-bottom: 15px;">
                  <button class="noticing-game-close-about" style="margin-top: 0;">Done</button>
              </div>

              <h3>Word Lists</h3>
              <p>Select a word list from the dropdown below or import your own custom list:</p>
              <div class="noticing-game-list-selector">
                  <label for="word-list-select">Select word list:</label>
                  <select id="word-list-select">
                      ${WLM.createWordListOptions()}
                  </select>
                  <div class="word-list-actions">
                      <button id="delete-list-button" class="delete-list-btn">Delete List</button>
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
              <p><strong>Version:</strong> 0.1.1</p>
              <p><strong>Developed by:</strong> Rafael Hernandez Bustamante</p>
              <p><strong>Contact:</strong> <a href="https://www.linkedin.com/in/rafaelhernandezbustamante" target="_blank">LinkedIn</a></p>
              <p><strong>Project:</strong> <a href="https://github.com/Rudull" target="_blank">GitHub</a></p>

              <h3>License</h3>
              <p>This software is licensed under GNU General Public License v3.0 (GPL-3)</p>
              <p>This is a free, copyleft license that ensures the software remains free for all users.</p>
              <p><a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">Read the full license</a></p>
          </div>
      `;

      setupSettingsPanelEvents(settingsPanel);
    });

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
    PM.makeDraggable(panel, header);

    // Add resize handle
    PM.addResizeHandle(panel);

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

    // Event listener para el cambio de lista
    setTimeout(() => {
      const listSelector = panel.querySelector("#word-list-select");
      if (listSelector) {
        listSelector.addEventListener("change", function () {
          const selectedListId = this.value;
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
              console.error("Error al cambiar lista:", response.message);
            }
          });
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

                WLM.deleteWordList(selectedListId, function (response) {
                  const importStatus = panel.querySelector(
                    ".import-list-status",
                  );
                  if (importStatus) {
                    importStatus.textContent = response.message;
                  }

                  if (response.success) {
                    // Actualizar el selector de listas
                    WLM.updateListSelector(listSelector);
                  }
                });
              },
            );
          }
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
            WLM.importWordList(
              contents,
              "txt",
              file.name.replace(/\.[^/.]+$/, ""), // Nombre sin extensión
              function (response) {
                importStatus.textContent = response.message;
                console.log("Import response:", response);

                if (response.success && response.listId) {
                  // Actualizar el selector de listas
                  WLM.updateListSelector(listSelector, response.listId);
                }
              },
            );
          };

          reader.readAsText(file);
        });
      }

      // Event listener para cerrar panel
      const closeAboutBtn = panel.querySelector(".noticing-game-close-about");
      if (closeAboutBtn) {
        closeAboutBtn.addEventListener("click", () => {
          panel.style.display = "none";
        });
      }
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

    // Inicializar el juego
    const gameState = GL.initializeGame(words);

    // Crear contador de puntos del usuario
    const userScoreContainer = UI.createTextElement(
      "div",
      '<span>Your score: </span><span id="user-score-value">0</span>',
      "noticing-game-user-score",
    );
    userScoreContainer.innerHTML =
      '<span>Your score: </span><span id="user-score-value">0</span>';
    wordList.appendChild(userScoreContainer);

    // Crear contenedor para los botones de palabras
    const wordButtonsContainer = UI.createContainer(
      "noticing-game-buttons-container",
    );
    wordList.appendChild(wordButtonsContainer);

    // Crear y agregar los botones de palabras
    gameState.displayedWords.forEach((wordInfo, index) => {
      const wordButton = GL.createWordButton(
        wordInfo,
        index,
        wordButtonsContainer,
        statusElement,
      );
      wordButtonsContainer.appendChild(wordButton);
    });

    // Agregar mensaje con el contador de palabras superadas
    const moreWordsInfo = UI.createTextElement(
      "div",
      "",
      "noticing-game-more-info",
    );

    // Preparamos la parte informativa sobre las palabras disponibles (si aplica)
    let shownText = "";
    if (words.length > 25) {
      shownText = `Showing 25 of ${words.length} words found. `;
    }

    // Agregamos el contador de palabras superadas
    moreWordsInfo.innerHTML = `${shownText}Overcome words: <span id="overcome-words-counter">0</span>`;

    wordList.appendChild(moreWordsInfo);
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
    YT.waitForYouTubeControls(() => {
      YT.createToggleButton(() => {
        const panel = createFloatingPanel();
        panel.style.display = panel.style.display === "none" ? "block" : "none";
      });
    });
  }

  // Exportar funciones públicas
  return {
    createFloatingPanel,
    waitForYouTubeControls,
    clearWordList,
    displayWords,
  };
})();
