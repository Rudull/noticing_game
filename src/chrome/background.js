// Script de fondo que se ejecuta en segundo plano

// Escuchar cuando se instala la extensión
chrome.runtime.onInstalled.addListener(function () {
  console.log("Noticing Game: Extensión instalada");

  // Cargar las listas de palabras desde word-list.json
  fetch(chrome.runtime.getURL("word-list.json"))
    .then((response) => response.json())
    .then((data) => {
      // Guardar toda la configuración de listas en el almacenamiento local
      chrome.storage.local.set(
        {
          wordListsConfig: data,
          currentWordList: data.defaultList,
          frequencyWordList: data.lists[data.defaultList].words,
        },
        function () {
          console.log(
            `Noticing Game: Lista de ${data.lists[data.defaultList].words.length} palabras inicializada (${data.lists[data.defaultList].name})`,
          );
        },
      );
    })
    .catch((error) => {
      console.error(
        "Noticing Game: Error al cargar las listas de palabras:",
        error,
      );
      // Fallback a una lista vacía en caso de error
      chrome.storage.local.set({
        wordListsConfig: { availableLists: [], defaultList: "", lists: {} },
        currentWordList: "",
        frequencyWordList: [],
      });
    });
});

// Escuchar mensajes de los otros scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "changeWordList") {
    chrome.storage.local.get(["wordListsConfig"], function (result) {
      if (
        result.wordListsConfig &&
        result.wordListsConfig.lists &&
        result.wordListsConfig.lists[request.listId]
      ) {
        chrome.storage.local.set(
          {
            currentWordList: request.listId,
            frequencyWordList:
              result.wordListsConfig.lists[request.listId].words,
          },
          function () {
            sendResponse({
              success: true,
              message: `Lista de palabras cambiada a: ${result.wordListsConfig.lists[request.listId].name}`,
            });
          },
        );
      } else {
        sendResponse({
          success: false,
          message: "Lista de palabras no encontrada",
        });
      }
    });
    return true;
  }

  if (request.action === "importWordList") {
    try {
      console.log("Processing import request:", request);

      // Manejar diferentes tipos de archivos
      let wordList = [];
      let newList = {
        name: request.fileName || "Custom List",
        description: "Custom imported word list",
        words: [],
      };

      if (request.fileType === "txt") {
        // Procesar archivo TXT (una palabra por línea)
        const lines = request.fileData.split(/\r?\n/);
        wordList = lines
          .filter((line) => line.trim().length > 0)
          .map((line) => line.trim().toLowerCase());
        console.log(`Processed TXT file, found ${wordList.length} words`);
      } else if (
        typeof request.fileData === "string" &&
        request.fileData.startsWith("{")
      ) {
        // Formato JSON (para compatibilidad con versiones anteriores)
        try {
          const jsonData = JSON.parse(request.fileData);
          if (jsonData.name) newList.name = jsonData.name;
          if (jsonData.description) newList.description = jsonData.description;
          if (Array.isArray(jsonData.words)) wordList = jsonData.words;
          else {
            sendResponse({
              success: false,
              message: "Invalid JSON format. Must contain a 'words' array.",
            });
            return true;
          }
        } catch (e) {
          sendResponse({
            success: false,
            message: "Invalid JSON format: " + e.message,
          });
          return true;
        }
      } else {
        sendResponse({
          success: false,
          message:
            "Unsupported file format. Please use TXT files (one word per line).",
        });
        return true;
      }

      // Validar que la lista tenga palabras
      if (wordList.length === 0) {
        sendResponse({
          success: false,
          message: "No words found in the file",
        });
        return true;
      }

      // Filtrar palabras vacías y duplicadas
      newList.words = [
        ...new Set(wordList.filter((word) => word && typeof word === "string")),
      ];
      console.log(`Final list has ${newList.words.length} unique words`);

      // Generar ID único para la lista
      const listId = "custom_" + Date.now();

      // Agregar la nueva lista a la configuración
      chrome.storage.local.get(["wordListsConfig"], function (result) {
        const config = result.wordListsConfig || {
          availableLists: [],
          defaultList: "",
          lists: {},
        };

        // Agregar la nueva lista
        config.availableLists.push(listId);
        config.lists[listId] = newList;
        console.log("Adding new list to config:", listId);

        // Guardar la configuración actualizada
        chrome.storage.local.set(
          {
            wordListsConfig: config,
            currentWordList: listId,
            frequencyWordList: newList.words,
          },
          function () {
            console.log("Storage updated with new list");
            sendResponse({
              success: true,
              message: `List "${newList.name}" imported successfully with ${newList.words.length} words`,
              listId: listId, // Devolver el ID de la lista para actualización UI inmediata
            });
          },
        );
      });

      return true;
    } catch (error) {
      console.error("Import error:", error);
      sendResponse({
        success: false,
        message: `Error importing list: ${error.message}`,
      });
      return true;
    }
  }

  if (request.action === "deleteWordList") {
    console.log("Received delete request for list:", request.listId);

    if (!request.listId) {
      sendResponse({
        success: false,
        message: "No list ID provided",
      });
      return true;
    }

    // No permitir eliminar listas predefinidas
    if (
      request.listId === "english_top_100" ||
      request.listId === "spanish_top_100"
    ) {
      sendResponse({
        success: false,
        message: "Default lists cannot be deleted",
      });
      return true;
    }

    chrome.storage.local.get(
      ["wordListsConfig", "currentWordList", "frequencyWordList"],
      function (result) {
        const config = result.wordListsConfig;

        if (!config || !config.lists || !config.lists[request.listId]) {
          console.log("List not found:", request.listId);
          sendResponse({
            success: false,
            message: "List not found",
          });
          return;
        }

        console.log("Found list to delete:", request.listId);
        const listName = config.lists[request.listId].name;

        // Eliminar la lista
        delete config.lists[request.listId];
        config.availableLists = config.availableLists.filter(
          (id) => id !== request.listId,
        );

        console.log("Filtered available lists:", config.availableLists);

        // Si la lista actual era la eliminada, cambiar a la primera disponible
        let newCurrentList = result.currentWordList;
        let newFrequencyWordList = result.frequencyWordList;

        if (
          result.currentWordList === request.listId &&
          config.availableLists.length > 0
        ) {
          newCurrentList = config.availableLists[0];
          newFrequencyWordList = config.lists[newCurrentList].words;
          console.log("Switching to new list:", newCurrentList);
        }

        // Guardar la configuración actualizada
        chrome.storage.local.set(
          {
            wordListsConfig: config,
            currentWordList: newCurrentList,
            frequencyWordList: newFrequencyWordList,
          },
          function () {
            console.log("Storage updated after deletion");
            sendResponse({
              success: true,
              message: `List "${listName}" has been deleted`,
            });
          },
        );
      },
    );

    return true;
  }

  // --- Proxy handlers for Local Server communication (Bypass Mixed Content) ---

  if (request.action === "checkServerStatus") {
    const backendUrl = request.backendUrl || "http://localhost:5000";

    fetch(`${backendUrl}/`)
      .then(response => {
        if (response.ok) return response.json();
        throw new Error("Server response not ok");
      })
      .then(data => {
        sendResponse({
          success: true,
          isOnline: data.status === "running",
          data: data
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          isOnline: false,
          error: error.message
        });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === "extractSubtitles") {
    const backendUrl = request.backendUrl || "http://localhost:5000";
    const videoUrl = request.videoUrl;

    fetch(`${backendUrl}/extract-subtitles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: videoUrl }),
    })
      .then(response => {
        if (!response.ok) {
          // Try to parse error message if possible
          return response.json().then(errData => {
            throw new Error(errData.error || `Server error: ${response.status}`);
          }).catch(() => {
            throw new Error(`Server error: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === "checkServerVersion") {
    const backendUrl = request.backendUrl || "http://localhost:5000";

    fetch(`${backendUrl}/info`)
      .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

console.log("Noticing Game: Background script cargado");
