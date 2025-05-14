// Módulo para extraer y parsear subtítulos de YouTube
window.SubtitleExtraction = (function () {
  // Función para precargar subtítulos con timestamps
  async function preloadSubtitlesWithTimestamps() {
    try {
      // Obtener los datos de subtítulos desde el reproductor
      const playerResponse =
        await extractSubtitlesFromPlayerDataWithTimestamps();

      // Almacenar subtítulos organizados por timestamps para acceso rápido
      const subtitlesMap = {};

      if (playerResponse && playerResponse.subtitles) {
        // Organizar subtítulos por tiempo
        playerResponse.subtitles.forEach((subtitle) => {
          if (subtitle.startTime !== undefined) {
            subtitlesMap[subtitle.startTime] = subtitle.text;
          }
        });

        console.log(
          `Noticing Game: Preloaded ${Object.keys(subtitlesMap).length} subtitles with timestamps`,
        );
        return subtitlesMap;
      }

      return null;
    } catch (error) {
      console.error("Error preloading subtitles with timestamps:", error);
      return null;
    }
  }

  // Función para extraer subtítulos con timestamps
  async function extractSubtitlesFromPlayerDataWithTimestamps() {
    return new Promise((resolve, reject) => {
      try {
        // Acceder a los datos del reproductor de YouTube
        let playerData = null;

        // Método 1: Buscar en ytInitialPlayerResponse
        if (window.ytInitialPlayerResponse) {
          playerData = window.ytInitialPlayerResponse;
        }

        // Método 2: Buscar el script que contiene ytInitialPlayerResponse
        if (!playerData) {
          const scripts = document.querySelectorAll("script");
          for (const script of scripts) {
            if (script.textContent.includes("ytInitialPlayerResponse")) {
              const match = script.textContent.match(
                /ytInitialPlayerResponse\s*=\s*({.+?});/,
              );
              if (match && match[1]) {
                try {
                  playerData = JSON.parse(match[1]);
                  break;
                } catch (e) {
                  console.error("Error parsing ytInitialPlayerResponse", e);
                }
              }
            }
          }
        }

        if (!playerData) {
          throw new Error("Could not access player data");
        }

        // Buscar datos de subtítulos en diferentes rutas posibles
        let captionTracks = [];

        // Ruta 1: Buscar en captions.playerCaptionsTracklistRenderer.captionTracks
        if (
          playerData.captions &&
          playerData.captions.playerCaptionsTracklistRenderer &&
          playerData.captions.playerCaptionsTracklistRenderer.captionTracks
        ) {
          captionTracks =
            playerData.captions.playerCaptionsTracklistRenderer.captionTracks;
        }
        // Ruta 2: Buscar en rutas alternativas
        else if (playerData.args && playerData.args.player_response) {
          try {
            const playerResponse = JSON.parse(playerData.args.player_response);
            if (
              playerResponse.captions &&
              playerResponse.captions.playerCaptionsTracklistRenderer &&
              playerResponse.captions.playerCaptionsTracklistRenderer
                .captionTracks
            ) {
              captionTracks =
                playerResponse.captions.playerCaptionsTracklistRenderer
                  .captionTracks;
            }
          } catch (e) {
            console.error("Error parsing player_response", e);
          }
        }

        if (captionTracks.length === 0) {
          throw new Error("No subtitle tracks found");
        }

        // Seleccionar pista preferida (inglés o primera disponible)
        let selectedTrack = captionTracks[0];
        const englishTrack = captionTracks.find(
          (track) =>
            track.languageCode === "en" || track.languageCode.startsWith("en-"),
        );

        if (englishTrack) {
          selectedTrack = englishTrack;
        }

        // La URL de subtítulos está disponible en selectedTrack.baseUrl
        console.log(
          `Noticing Game: Subtitle URL found: ${selectedTrack.baseUrl}`,
        );

        // Descargar el contenido de subtítulos
        fetch(selectedTrack.baseUrl)
          .then((response) => response.text())
          .then((content) => {
            // Parsear subtítulos con timestamps
            const subtitlesWithTime = parseSubtitleXmlWithTimestamps(content);
            resolve({
              success: true,
              subtitles: subtitlesWithTime,
              language: selectedTrack.languageCode,
              source: "player-data-with-timestamps",
            });
          })
          .catch((error) => {
            throw new Error(`Error downloading subtitles: ${error.message}`);
          });
      } catch (error) {
        console.error("Error extracting player data with timestamps:", error);
        reject(error);
      }
    });
  }

  // Función para parsear XML de subtítulos con timestamps
  function parseSubtitleXmlWithTimestamps(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    const textElements = xmlDoc.getElementsByTagName("text");

    // Extraer texto y tiempos de cada elemento
    const subtitlesWithTime = [];
    for (let i = 0; i < textElements.length; i++) {
      const element = textElements[i];
      const text = element.textContent.trim();

      if (text) {
        // Extraer atributos de tiempo del XML
        const startTime = parseFloat(element.getAttribute("start") || 0);
        const duration = parseFloat(element.getAttribute("dur") || 0);

        subtitlesWithTime.push({
          text: text,
          startTime: startTime,
          endTime: startTime + duration,
        });
      }
    }

    return subtitlesWithTime;
  }

  // Función principal para obtener subtítulos
  async function getYouTubeSubtitles() {
    try {
      console.log("Noticing Game: Attempting to extract from player data...");
      return await extractSubtitlesFromPlayerData();
    } catch (error) {
      console.log(
        "Noticing Game: Player data method failed, attempting DOM capture...",
      );
      try {
        return await extractSubtitlesFromPage();
      } catch (domError) {
        throw new Error(
          `Could not obtain subtitles by any method: ${error.message}, ${domError.message}`,
        );
      }
    }
  }

  // Función para extraer subtítulos de los datos del reproductor
  async function extractSubtitlesFromPlayerData() {
    return new Promise((resolve, reject) => {
      try {
        // Acceder a los datos del reproductor de YouTube
        let playerData = null;

        // Método 1: Buscar en ytInitialPlayerResponse
        if (window.ytInitialPlayerResponse) {
          playerData = window.ytInitialPlayerResponse;
        }

        // Método 2: Buscar el script que contiene ytInitialPlayerResponse
        if (!playerData) {
          const scripts = document.querySelectorAll("script");
          for (const script of scripts) {
            if (script.textContent.includes("ytInitialPlayerResponse")) {
              const match = script.textContent.match(
                /ytInitialPlayerResponse\s*=\s*({.+?});/,
              );
              if (match && match[1]) {
                try {
                  playerData = JSON.parse(match[1]);
                  break;
                } catch (e) {
                  console.error("Error parsing ytInitialPlayerResponse", e);
                }
              }
            }
          }
        }

        if (!playerData) {
          throw new Error("Could not access player data");
        }

        // Buscar datos de subtítulos en diferentes rutas posibles
        let captionTracks = [];

        // Ruta 1: Buscar en captions.playerCaptionsTracklistRenderer.captionTracks
        if (
          playerData.captions &&
          playerData.captions.playerCaptionsTracklistRenderer &&
          playerData.captions.playerCaptionsTracklistRenderer.captionTracks
        ) {
          captionTracks =
            playerData.captions.playerCaptionsTracklistRenderer.captionTracks;
        }
        // Ruta 2: Buscar en rutas alternativas
        else if (playerData.args && playerData.args.player_response) {
          try {
            const playerResponse = JSON.parse(playerData.args.player_response);
            if (
              playerResponse.captions &&
              playerResponse.captions.playerCaptionsTracklistRenderer &&
              playerResponse.captions.playerCaptionsTracklistRenderer
                .captionTracks
            ) {
              captionTracks =
                playerResponse.captions.playerCaptionsTracklistRenderer
                  .captionTracks;
            }
          } catch (e) {
            console.error("Error parsing player_response", e);
          }
        }

        if (captionTracks.length === 0) {
          throw new Error("No subtitle tracks found");
        }

        // Seleccionar pista preferida (inglés o primera disponible)
        let selectedTrack = captionTracks[0];
        const englishTrack = captionTracks.find(
          (track) =>
            track.languageCode === "en" || track.languageCode.startsWith("en-"),
        );

        if (englishTrack) {
          selectedTrack = englishTrack;
        }

        // La URL de subtítulos está disponible en selectedTrack.baseUrl
        console.log(
          `Noticing Game: Subtitle URL found: ${selectedTrack.baseUrl}`,
        );

        // Descargar el contenido de subtítulos
        fetch(selectedTrack.baseUrl)
          .then((response) => response.text())
          .then((content) => {
            // Parsear los subtítulos (generalmente en formato XML)
            const subtitles = parseSubtitleXml(content);
            resolve({
              success: true,
              subtitles: subtitles,
              language: selectedTrack.languageCode,
              source: "player-data",
            });
          })
          .catch((error) => {
            throw new Error(`Error downloading subtitles: ${error.message}`);
          });
      } catch (error) {
        console.error("Error extracting player data:", error);
        reject(error);
      }
    });
  }

  // Función para parsear XML de subtítulos
  function parseSubtitleXml(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    const textElements = xmlDoc.getElementsByTagName("text");

    // Extraer texto de cada elemento
    const subtitles = [];
    for (let i = 0; i < textElements.length; i++) {
      const text = textElements[i].textContent.trim();
      if (text) {
        subtitles.push(text);

        // Procesar palabras para seguimiento
        const words = text
          .toLowerCase()
          .replace(/[.,?!;\"'\(\)\[\]{}:\/\\]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 0);

        chrome.storage.local.get(["frequencyWordList"], function (result) {
          if (result.frequencyWordList && result.frequencyWordList.length > 0) {
            const frequencyWordList = result.frequencyWordList;
            words.forEach((word) => {
              if (frequencyWordList.includes(word)) {
                // Usar la función del módulo de detección de palabras
                if (window.WordDetection) {
                  window.WordDetection.trackWordAppearance(word);
                  console.log(`Word detected: ${word}`);
                }
              }
            });
          }
        });
      }
    }

    return subtitles;
  }

  // Función para extraer subtítulos directamente de la página como alternativa
  async function extractSubtitlesFromPage() {
    return new Promise((resolve, reject) => {
      // Crear un array para almacenar todos los subtítulos durante la reproducción
      let collectedSubtitles = [];
      let lastSubtitleText = "";
      let isCollecting = true;

      // Función para capturar subtítulos cuando aparecen
      const captureSubtitles = () => {
        const subtitleElements = document.querySelectorAll(
          ".ytp-caption-segment",
        );

        if (subtitleElements && subtitleElements.length > 0) {
          const currentText = Array.from(subtitleElements)
            .map((el) => el.textContent)
            .join(" ");

          // Solo añadir si es diferente del último
          if (currentText !== lastSubtitleText) {
            lastSubtitleText = currentText;
            collectedSubtitles.push(currentText);
            console.log(`Subtitle captured: ${currentText}`);

            // Registrar palabras que aparecen en este subtítulo
            const words = currentText
              .toLowerCase()
              .replace(/[.,?!;\"'\(\)\[\]{}:\/\\]/g, "")
              .split(/\s+/)
              .filter((w) => w.length > 0);

            chrome.storage.local.get(["frequencyWordList"], function (result) {
              if (
                result.frequencyWordList &&
                result.frequencyWordList.length > 0
              ) {
                const frequencyWordList = result.frequencyWordList;
                words.forEach((word) => {
                  if (frequencyWordList.includes(word)) {
                    if (window.WordDetection) {
                      window.WordDetection.trackWordAppearance(word);
                      console.log(`Word captured from DOM: ${word}`);
                    }
                  }
                });
              }
            });
          }
        }

        // Continuar capturando si todavía estamos en modo de colección
        if (isCollecting) {
          requestAnimationFrame(captureSubtitles);
        }
      };

      // Función para verificar si los subtítulos están habilitados
      const checkAndActivateSubtitles = () => {
        // Comprobar si hay un botón CC y tratar de activarlo si no está ya habilitado
        const ccButton = document.querySelector(".ytp-subtitles-button");
        if (ccButton && ccButton.getAttribute("aria-pressed") !== "true") {
          console.log("Noticing Game: Activating subtitles automatically");
          ccButton.click();
        }
      };

      // Configurar un temporizador para detener la captura después de algún tiempo
      // (ajustado a la duración del video si es posible)
      let videoDuration = 60; // 60 segundos por defecto

      // Intentar obtener la duración real del video
      const videoElement = document.querySelector("video");
      if (videoElement && videoElement.duration) {
        videoDuration = videoElement.duration;
      }

      // Iniciar la captura
      checkAndActivateSubtitles();
      captureSubtitles();

      // Crear una UI para mostrar al usuario que se están capturando subtítulos
      const captureUI = document.createElement("div");
      captureUI.className = "noticing-game-capture-status";
      captureUI.textContent = "Capturing subtitles...";
      captureUI.style = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        z-index: 9999;
      `;
      document.body.appendChild(captureUI);

      // Proporcionar al usuario controles para finalizar la captura
      const stopBtn = document.createElement("button");
      stopBtn.textContent = "Finish capture";
      stopBtn.style = "margin-left: 10px; padding: 5px 10px; cursor: pointer;";
      stopBtn.onclick = () => {
        finishCapture();
      };
      captureUI.appendChild(stopBtn);

      // Finalizar la captura después de algún tiempo o cuando el usuario lo indique
      const finishCapture = () => {
        isCollecting = false;
        document.body.removeChild(captureUI);

        if (collectedSubtitles.length > 0) {
          console.log(
            `Noticing Game: Captured ${collectedSubtitles.length} subtitles`,
          );
          resolve({
            success: true,
            subtitles: collectedSubtitles,
            language: "detected-from-dom",
            source: "page",
          });
        } else {
          reject(
            new Error(
              "Could not capture subtitles. Make sure the video has subtitles and they are enabled.",
            ),
          );
        }
      };

      // Establecer un tiempo máximo de captura (75% de la duración del video o máximo 5 minutos)
      const maxCaptureTime = Math.min(
        videoDuration * 0.75 * 1000,
        5 * 60 * 1000,
      );
      setTimeout(finishCapture, maxCaptureTime);
    });
  }

  return {
    preloadSubtitlesWithTimestamps,
    extractSubtitlesFromPlayerDataWithTimestamps,
    parseSubtitleXmlWithTimestamps,
    getYouTubeSubtitles,
    extractSubtitlesFromPlayerData,
    extractSubtitlesFromPage,
    parseSubtitleXml,
  };
})();
