// Módulo de gestión de listas de palabras para Noticing Game
window.WordListManager = (function () {
  const UI = window.UIComponents;

  // Variables para almacenar la configuración de listas
  let wordListsConfig = null;
  let currentListId = "";

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
      "Extension context invalidated in WordListManager, cleaning up...",
    );

    // Limpiar configuración local
    wordListsConfig = null;
    currentListId = "";

    // Notificar al usuario si es posible
    try {
      const statusElements = document.querySelectorAll(
        ".noticing-game-status, .import-list-status",
      );
      statusElements.forEach((element) => {
        element.textContent =
          "Extension reloaded. Please refresh the page to continue.";
        element.style.color = "orange";
      });
    } catch (error) {
      console.warn("Could not update status elements:", error);
    }
  }

  // Evento de cambio en el almacenamiento
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    try {
      // Verificar contexto antes de procesar cambios
      if (!isExtensionContextValid()) {
        handleInvalidContext();
        return;
      }

      if (namespace === "local") {
        if (changes.wordListsConfig) {
          wordListsConfig = changes.wordListsConfig.newValue;
        }
        if (changes.currentWordList) {
          currentListId = changes.currentWordList.newValue;
        }
      }
    } catch (error) {
      console.error("Error in storage change listener:", error);
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        handleInvalidContext();
      }
    }
  });

  // Cargar configuración de listas
  function loadWordListConfig() {
    return new Promise((resolve, reject) => {
      // Verificar contexto antes de usar Chrome APIs
      if (!isExtensionContextValid()) {
        handleInvalidContext();
        reject(new Error("Extension context invalidated"));
        return;
      }

      try {
        chrome.storage.local.get(
          ["wordListsConfig", "currentWordList"],
          function (result) {
            try {
              // Verificar contexto en el callback
              if (!isExtensionContextValid()) {
                handleInvalidContext();
                reject(new Error("Extension context invalidated during load"));
                return;
              }

              wordListsConfig = result.wordListsConfig || {
                availableLists: [],
                lists: {},
              };
              currentListId = result.currentWordList || "";
              resolve({ wordListsConfig, currentListId });
            } catch (error) {
              console.error("Error in loadWordListConfig callback:", error);
              if (
                error.message &&
                error.message.includes("Extension context invalidated")
              ) {
                handleInvalidContext();
              }
              reject(error);
            }
          },
        );
      } catch (error) {
        console.error("Error in loadWordListConfig:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        reject(error);
      }
    });
  }

  // Crear opciones para el selector de listas
  function createWordListOptions() {
    console.log("Creating word list options with config:", wordListsConfig);
    console.log("Current list ID:", currentListId);

    // Obtener la configuración más reciente si no está disponible
    if (!wordListsConfig || !wordListsConfig.availableLists) {
      console.log("Config not available, fetching from storage");

      // Verificar contexto antes de usar Chrome APIs
      if (!isExtensionContextValid()) {
        handleInvalidContext();
        return '<option value="">Extension context invalid</option>';
      }

      try {
        // Si estamos creando opciones y no tenemos la configuración, la obtenemos de inmediato
        chrome.storage.local.get(
          ["wordListsConfig", "currentWordList"],
          function (result) {
            try {
              // Verificar contexto en el callback
              if (!isExtensionContextValid()) {
                handleInvalidContext();
                return;
              }

              if (result.wordListsConfig) {
                wordListsConfig = result.wordListsConfig;
                currentListId = result.currentWordList || "";
                // Actualizar el selector con los datos obtenidos
                const listSelector =
                  document.querySelector("#word-list-select");
                if (listSelector) {
                  listSelector.innerHTML = createWordListOptions();
                }
              }
            } catch (error) {
              console.error("Error in createWordListOptions callback:", error);
              if (
                error.message &&
                error.message.includes("Extension context invalidated")
              ) {
                handleInvalidContext();
              }
            }
          },
        );
      } catch (error) {
        console.error("Error in createWordListOptions:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        return '<option value="">Error loading lists</option>';
      }
      return '<option value="">Loading lists...</option>';
    }

    if (wordListsConfig.availableLists.length === 0) {
      console.log("No lists available");
      return '<option value="">No lists available</option>';
    }

    let options = "";
    wordListsConfig.availableLists.forEach((listId) => {
      if (wordListsConfig.lists[listId]) {
        const list = wordListsConfig.lists[listId];
        const selected = listId === currentListId ? "selected" : "";
        options += `<option value="${listId}" ${selected}>${list.name}</option>`;
      }
    });

    console.log("Generated options:", options);
    return options;
  }

  // Cambiar la lista actual
  function changeWordList(listId, callback) {
    // Verificar contexto antes de usar Chrome APIs
    if (!isExtensionContextValid()) {
      handleInvalidContext();
      if (callback) {
        callback({
          success: false,
          message: "Extension context invalidated. Please refresh the page.",
        });
      }
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: "changeWordList", listId: listId },
        function (response) {
          try {
            // Verificar contexto en el callback
            if (!isExtensionContextValid()) {
              handleInvalidContext();
              if (callback) {
                callback({
                  success: false,
                  message: "Extension context invalidated during change.",
                });
              }
              return;
            }

            if (callback) callback(response);
          } catch (error) {
            console.error("Error in changeWordList callback:", error);
            if (
              error.message &&
              error.message.includes("Extension context invalidated")
            ) {
              handleInvalidContext();
            }
            if (callback) {
              callback({
                success: false,
                message: "Error processing change response: " + error.message,
              });
            }
          }
        },
      );
    } catch (error) {
      console.error("Error in changeWordList:", error);
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        handleInvalidContext();
      }
      if (callback) {
        callback({
          success: false,
          message: "Error sending change message: " + error.message,
        });
      }
    }
  }

  // Importar una lista nueva
  function importWordList(fileData, fileType, fileName, callback) {
    try {
      let wordList = [];
      let newList = {
        name: fileName || "Custom List",
        description: "Custom imported word list",
        words: [],
      };

      if (fileType === "txt") {
        // Procesar archivo TXT preservando contracciones
        const lines = fileData.split(/\r?\n/);
        wordList = lines
          .filter((line) => line.trim().length > 0)
          .map((line) => {
            return line
              .trim()
              .toLowerCase()
              .replace(/([.,?!;"(\)\[\]{}:\/\\-])/g, "")
              .trim();
          });
      }

      // Validar lista
      if (wordList.length === 0) {
        callback({
          success: false,
          message: "No valid words or contractions found in the file",
        });
        return;
      }

      // Filtrar duplicados preservando apóstrofes
      newList.words = [
        ...new Set(wordList.filter((word) => word && word.length > 0)),
      ];

      const listId = "custom_" + Date.now();

      chrome.storage.local.get(["wordListsConfig"], function (result) {
        const config = result.wordListsConfig || {
          availableLists: [],
          defaultList: "",
          lists: {},
        };

        config.availableLists.push(listId);
        config.lists[listId] = newList;

        chrome.storage.local.set(
          {
            wordListsConfig: config,
            currentWordList: listId,
            frequencyWordList: newList.words,
          },
          function () {
            callback({
              success: true,
              message: `List imported successfully with ${newList.words.length} items`,
              listId: listId,
            });
          },
        );
      });
    } catch (error) {
      console.error("Import error:", error);
      callback({
        success: false,
        message: `Error importing list: ${error.message}`,
      });
    }
  }

  // Eliminar una lista
  function deleteWordList(listId, callback) {
    // Verificar contexto antes de usar Chrome APIs
    if (!isExtensionContextValid()) {
      handleInvalidContext();
      if (callback) {
        callback({
          success: false,
          message: "Extension context invalidated. Please refresh the page.",
        });
      }
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: "deleteWordList", listId: listId },
        function (response) {
          try {
            // Verificar contexto en el callback
            if (!isExtensionContextValid()) {
              handleInvalidContext();
              if (callback) {
                callback({
                  success: false,
                  message: "Extension context invalidated during deletion.",
                });
              }
              return;
            }

            if (callback) callback(response);
          } catch (error) {
            console.error("Error in deleteWordList callback:", error);
            if (
              error.message &&
              error.message.includes("Extension context invalidated")
            ) {
              handleInvalidContext();
            }
            if (callback) {
              callback({
                success: false,
                message: "Error processing delete response: " + error.message,
              });
            }
          }
        },
      );
    } catch (error) {
      console.error("Error in deleteWordList:", error);
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        handleInvalidContext();
      }
      if (callback) {
        callback({
          success: false,
          message: "Error sending delete message: " + error.message,
        });
      }
    }
  }

  // Actualizar selector de listas después de cambios
  function updateListSelector(selector, newListId = null) {
    // Verificar contexto antes de proceder
    if (!isExtensionContextValid()) {
      handleInvalidContext();
      return Promise.reject(new Error("Extension context invalidated"));
    }

    return loadWordListConfig()
      .then(() => {
        try {
          // Verificar contexto después de cargar configuración
          if (!isExtensionContextValid()) {
            handleInvalidContext();
            return Promise.reject(
              new Error("Extension context invalidated after load"),
            );
          }

          // Limpiar las opciones actuales
          selector.innerHTML = "";

          // Crear nuevas opciones con datos actualizados
          if (
            wordListsConfig &&
            wordListsConfig.availableLists &&
            wordListsConfig.availableLists.length > 0
          ) {
            // Añadir nuevas opciones
            wordListsConfig.availableLists.forEach((listId) => {
              if (wordListsConfig.lists[listId]) {
                const opt = document.createElement("option");
                opt.value = listId;
                opt.textContent = wordListsConfig.lists[listId].name;
                opt.selected = newListId
                  ? listId === newListId
                  : listId === currentListId;
                selector.appendChild(opt);
              }
            });

            // Si se especificó un nuevo ID de lista, seleccionarlo
            if (newListId) {
              selector.value = newListId;
              selector.dispatchEvent(new Event("change"));
            }
          }
        } catch (error) {
          console.error("Error updating list selector:", error);
          if (
            error.message &&
            error.message.includes("Extension context invalidated")
          ) {
            handleInvalidContext();
          }
          throw error;
        }
      })
      .catch((error) => {
        console.error("Error in updateListSelector:", error);
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          handleInvalidContext();
        }
        throw error;
      });
  }

  // Exportar funciones públicas
  return {
    loadWordListConfig,
    createWordListOptions,
    changeWordList,
    importWordList,
    deleteWordList,
    updateListSelector,
    getCurrentListId: () => currentListId,
    getWordListsConfig: () => wordListsConfig,
  };
})();
