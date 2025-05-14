// Módulo de gestión de listas de palabras para Noticing Game
window.WordListManager = (function () {
  const UI = window.UIComponents;

  // Variables para almacenar la configuración de listas
  let wordListsConfig = null;
  let currentListId = "";

  // Evento de cambio en el almacenamiento
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === "local") {
      if (changes.wordListsConfig) {
        wordListsConfig = changes.wordListsConfig.newValue;
      }
      if (changes.currentWordList) {
        currentListId = changes.currentWordList.newValue;
      }
    }
  });

  // Cargar configuración de listas
  function loadWordListConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["wordListsConfig", "currentWordList"],
        function (result) {
          wordListsConfig = result.wordListsConfig || {
            availableLists: [],
            lists: {},
          };
          currentListId = result.currentWordList || "";
          resolve({ wordListsConfig, currentListId });
        },
      );
    });
  }

  // Crear opciones para el selector de listas
  function createWordListOptions() {
    console.log("Creating word list options with config:", wordListsConfig);
    console.log("Current list ID:", currentListId);

    // Obtener la configuración más reciente si no está disponible
    if (!wordListsConfig || !wordListsConfig.availableLists) {
      console.log("Config not available, fetching from storage");
      // Si estamos creando opciones y no tenemos la configuración, la obtenemos de inmediato
      chrome.storage.local.get(
        ["wordListsConfig", "currentWordList"],
        function (result) {
          if (result.wordListsConfig) {
            wordListsConfig = result.wordListsConfig;
            currentListId = result.currentWordList || "";
            // Actualizar el selector con los datos obtenidos
            const listSelector = document.querySelector("#word-list-select");
            if (listSelector) {
              listSelector.innerHTML = createWordListOptions();
            }
          }
        },
      );
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
    chrome.runtime.sendMessage(
      { action: "changeWordList", listId: listId },
      function (response) {
        if (callback) callback(response);
      },
    );
  }

  // Importar una lista nueva
  function importWordList(fileData, fileType, fileName, callback) {
    chrome.runtime.sendMessage(
      {
        action: "importWordList",
        fileData: fileData,
        fileType: fileType,
        fileName: fileName,
      },
      function (response) {
        if (callback) callback(response);
      },
    );
  }

  // Eliminar una lista
  function deleteWordList(listId, callback) {
    chrome.runtime.sendMessage(
      { action: "deleteWordList", listId: listId },
      function (response) {
        if (callback) callback(response);
      },
    );
  }

  // Actualizar selector de listas después de cambios
  function updateListSelector(selector, newListId = null) {
    return loadWordListConfig().then(() => {
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
