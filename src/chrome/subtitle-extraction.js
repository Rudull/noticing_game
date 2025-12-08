// Módulo para extraer y parsear subtítulos de YouTube
console.log("Noticing Game: Loading SubtitleExtraction module...");

try {
    window.SubtitleExtraction = (function () {
        // URL del servidor backend (puerto configurable)
        let BACKEND_URL = "http://localhost:5000"; // Valor por defecto

        // Cargar el puerto configurado
        function loadBackendPort() {
            return new Promise((resolve) => {
                if (typeof chrome !== "undefined" && chrome.storage) {
                    chrome.storage.local.get(
                        ["backendServerPort"],
                        function (result) {
                            const port = result.backendServerPort || 5000;
                            BACKEND_URL = `http://localhost:${port}`;
                            console.log(
                                `SubtitleExtraction: Backend URL set to ${BACKEND_URL}`,
                            );
                            resolve(port);
                        },
                    );
                } else {
                    // Fallback si chrome.storage no está disponible
                    BACKEND_URL = "http://localhost:5000";
                    resolve(5000);
                }
            });
        }

        // Inicializar el puerto al cargar el módulo
        loadBackendPort();

        // Estado del servidor
        let serverStatus = {
            isOnline: false,
            lastCheck: 0,
            checkInterval: 5000, // 5 segundos
            hasShownOfflineMessage: false,
        };

        // Función para verificar si el servidor está en línea
        async function checkServerStatus() {
            const now = Date.now();

            // Evitar verificaciones muy frecuentes
            if (now - serverStatus.lastCheck < serverStatus.checkInterval) {
                return serverStatus.isOnline;
            }

            return new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    {
                        action: "checkServerStatus",
                        backendUrl: BACKEND_URL
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.log("Runtime error checking server:", chrome.runtime.lastError.message);
                            serverStatus.isOnline = false;
                        } else if (response && response.success) {
                            serverStatus.isOnline = response.isOnline;

                            if (serverStatus.isOnline && serverStatus.hasShownOfflineMessage) {
                                showServerOnlineMessage();
                                serverStatus.hasShownOfflineMessage = false;
                            }
                        } else {
                            serverStatus.isOnline = false;
                        }

                        serverStatus.lastCheck = now;
                        resolve(serverStatus.isOnline);
                    }
                );
            });
        }

        // ... (keep existing code) ...

        // Función principal para obtener subtítulos
        async function getYouTubeSubtitles() {
            try {
                console.log(
                    "Noticing Game: Attempting to extract subtitles using backend server...",
                );

                // Verificar estado del servidor primero
                const isServerOnline = await checkServerStatus();

                if (!isServerOnline) {
                    console.log(
                        "Backend server is offline, showing setup guide...",
                    );
                    showServerSetupGuide();
                    updateServerStatusInUI(false);
                    throw new Error(
                        "Backend server is not running. Please start the subtitle extraction server.",
                    );
                }

                // Obtener el ID del video actual
                const videoId = window.YouTubeVideoUtils.getYouTubeVideoId();
                if (!videoId) {
                    throw new Error("No video ID found");
                }

                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

                // Llamar al backend para obtener subtítulos VIA BACKGROUND SCRIPT
                const data = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        {
                            action: "extractSubtitles",
                            backendUrl: BACKEND_URL,
                            videoUrl: videoUrl
                        },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else if (response && response.success) {
                                resolve(response.data);
                            } else {
                                reject(new Error(response ? response.error : "Unknown error"));
                            }
                        }
                    );
                });

                if (!data.success) {
                    // Si el backend dice que no hay subtítulos, mostrar alerta
                    if (
                        data.error &&
                        data.error.includes("No subtitles available")
                    ) {
                        alert(
                            "Este video no tiene subtítulos. Por favor elige un video con subtítulos (automáticos o manuales) para usar Noticing Game.",
                        );
                    }
                    throw new Error(data.error || "Backend extraction failed");
                }

                console.log(
                    `Noticing Game: Successfully extracted ${data.subtitle_count} subtitles from backend`,
                );
                console.log(
                    `Video: ${data.video_title} (Language: ${data.language}, Source: ${data.source})`,
                );

                // Convertir formato del backend al formato esperado por la extensión
                const subtitles = data.subtitles.map((sub) => sub.text);

                // También procesar para detección de palabras en tiempo real
                if (data.subtitles && Array.isArray(data.subtitles)) {
                    chrome.storage.local.get(
                        ["frequencyWordList"],
                        function (result) {
                            if (
                                result.frequencyWordList &&
                                result.frequencyWordList.length > 0
                            ) {
                                const frequencyWordList = result.frequencyWordList;

                                data.subtitles.forEach((subtitle) => {
                                    // Usar la función centralizada para procesar el texto
                                    if (window.TextProcessing) {
                                        window.TextProcessing.processSubtitleTextForWordDetection(
                                            subtitle.text,
                                            frequencyWordList,
                                            function (word) {
                                                // Usar la función del módulo de detección de palabras
                                                if (window.WordDetection) {
                                                    // Usar el timestamp del subtítulo convertido a milisegundos
                                                    const timestamp = Math.floor(
                                                        subtitle.start * 1000,
                                                    );
                                                    window.WordDetection.trackWordAppearance(
                                                        word,
                                                        timestamp,
                                                    );
                                                    console.log(
                                                        `Word detected from backend: ${word} at ${subtitle.start}s`,
                                                    );
                                                }
                                            },
                                        );
                                    }
                                });
                            }
                        },
                    );
                }

                return {
                    success: true,
                    subtitles: subtitles,
                    language: data.language,
                    source: "backend-yt-dlp",
                    video_title: data.video_title,
                    subtitle_count: data.subtitle_count,
                };
            } catch (error) {
                console.error("Noticing Game: Backend extraction failed:", error);

                // Si el backend no está disponible, mostrar guía y actualizar estado
                if (
                    error.message.includes("Failed to fetch") ||
                    error.message.includes("ECONNREFUSED") ||
                    error.message.includes("Backend server is not running")
                ) {
                    console.log("Backend server appears to be offline.");
                    serverStatus.isOnline = false;

                    if (!serverStatus.hasShownOfflineMessage) {
                        showServerSetupGuide();
                    }
                    updateServerStatusInUI(false);

                    // Intentar método de respaldo (DOM capture) como último recurso
                    try {
                        console.log("Attempting fallback DOM extraction...");
                        const fallbackResult = await extractSubtitlesFromPage();

                        // Mostrar advertencia sobre el método de respaldo
                        const statusElements = document.querySelectorAll(
                            ".noticing-game-status",
                        );
                        statusElements.forEach((element) => {
                            element.innerHTML = `
                            <div style="color: orange; font-weight: bold;">
                                ⚠️ Modo de emergencia - Funcionalidad limitada
                            </div>
                            <div style="font-size: 12px;">
                                Para todas las funciones, instala y enciende el servidor de subtítulos.
                            </div>
                        `;
                        });

                        return fallbackResult;
                    } catch (fallbackError) {
                        throw new Error(
                            `El servidor está apagado. Por favor instálalo y enciéndelo para todas las funciones. Ya se mostró la guía de ayuda.`,
                        );
                    }
                }

                throw error;
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
                            if (
                                script.textContent.includes(
                                    "ytInitialPlayerResponse",
                                )
                            ) {
                                const match = script.textContent.match(
                                    /ytInitialPlayerResponse\s*=\s*({.+?});/,
                                );
                                if (match && match[1]) {
                                    try {
                                        playerData = JSON.parse(match[1]);
                                        break;
                                    } catch (e) {
                                        console.error(
                                            "Error parsing ytInitialPlayerResponse",
                                            e,
                                        );
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
                        playerData.captions.playerCaptionsTracklistRenderer
                            .captionTracks
                    ) {
                        captionTracks =
                            playerData.captions.playerCaptionsTracklistRenderer
                                .captionTracks;
                    }
                    // Ruta 2: Buscar en rutas alternativas
                    else if (playerData.args && playerData.args.player_response) {
                        try {
                            const playerResponse = JSON.parse(
                                playerData.args.player_response,
                            );
                            if (
                                playerResponse.captions &&
                                playerResponse.captions
                                    .playerCaptionsTracklistRenderer &&
                                playerResponse.captions
                                    .playerCaptionsTracklistRenderer.captionTracks
                            ) {
                                captionTracks =
                                    playerResponse.captions
                                        .playerCaptionsTracklistRenderer
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
                            track.languageCode === "en" ||
                            track.languageCode.startsWith("en-"),
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
                            throw new Error(
                                `Error downloading subtitles: ${error.message}`,
                            );
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

                    // Usar el procesamiento centralizado de texto
                    // Note: Word detection is now handled in getYouTubeSubtitles for backend extraction
                    // This fallback method still processes words in real-time
                    chrome.storage.local.get(
                        ["frequencyWordList"],
                        function (result) {
                            if (
                                result.frequencyWordList &&
                                result.frequencyWordList.length > 0
                            ) {
                                const frequencyWordList = result.frequencyWordList;

                                // Usar la función centralizada para procesar el texto
                                if (window.TextProcessing) {
                                    window.TextProcessing.processSubtitleTextForWordDetection(
                                        text,
                                        frequencyWordList,
                                        function (word) {
                                            // Usar la función del módulo de detección de palabras
                                            if (window.WordDetection) {
                                                window.WordDetection.trackWordAppearance(
                                                    word,
                                                );
                                                console.log(
                                                    `Word detected (fallback): ${word}`,
                                                );
                                            }
                                        },
                                    );
                                }
                            }
                        },
                    );
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

                            // Usar el procesamiento centralizado de texto
                            chrome.storage.local.get(
                                ["frequencyWordList"],
                                function (result) {
                                    if (
                                        result.frequencyWordList &&
                                        result.frequencyWordList.length > 0
                                    ) {
                                        const frequencyWordList =
                                            result.frequencyWordList;

                                        // Usar la función centralizada para procesar el texto
                                        // Note: This is fallback DOM capture when backend is not available
                                        if (window.TextProcessing) {
                                            window.TextProcessing.processSubtitleTextForWordDetection(
                                                currentText,
                                                frequencyWordList,
                                                function (word) {
                                                    if (window.WordDetection) {
                                                        window.WordDetection.trackWordAppearance(
                                                            word,
                                                        );
                                                        console.log(
                                                            `Word captured from DOM (fallback): ${word}`,
                                                        );
                                                    }
                                                },
                                            );
                                        }
                                    }
                                },
                            );
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
                    const ccButton = document.querySelector(
                        ".ytp-subtitles-button",
                    );
                    if (
                        ccButton &&
                        ccButton.getAttribute("aria-pressed") !== "true"
                    ) {
                        console.log(
                            "Noticing Game: Activating subtitles automatically",
                        );
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
                captureUI.textContent = "Capturando subtítulos...";
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
                stopBtn.textContent = "Finalizar captura";
                stopBtn.style =
                    "margin-left: 10px; padding: 5px 10px; cursor: pointer;";
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
                                "No se pudieron capturar subtítulos. Asegúrate de que el video tenga subtítulos y que estén activados.",
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

        // Verificar estado del servidor periódicamente
        setInterval(async () => {
            if (!serverStatus.isOnline) {
                await checkServerStatus();
                if (serverStatus.isOnline) {
                    updateServerStatusInUI(true);
                }
            }
        }, 10000); // Verificar cada 10 segundos si está offline

        // --- Funciones auxiliares y de compatibilidad ---

        async function preloadSubtitlesWithTimestamps() {
            console.log("SubtitleExtraction: preloadSubtitlesWithTimestamps called");
            return getYouTubeSubtitles();
        }

        async function extractSubtitlesFromPlayerDataWithTimestamps() {
            // Reutilizar la lógica de extracción de player data pero asegurando formato con timestamps
            // Por ahora delegamos a la función base que ya maneja la lógica
            return extractSubtitlesFromPlayerData();
        }

        function parseSubtitleXmlWithTimestamps(xmlContent) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            const textElements = xmlDoc.getElementsByTagName("text");
            const subtitles = [];

            for (let i = 0; i < textElements.length; i++) {
                const el = textElements[i];
                const text = el.textContent.trim();
                const start = parseFloat(el.getAttribute("start"));
                const dur = parseFloat(el.getAttribute("dur"));

                if (text) {
                    subtitles.push({
                        text: text,
                        start: start,
                        end: start + (dur || 0)
                    });
                }
            }
            return subtitles;
        }

        // Funciones de UI para el estado del servidor
        function showServerSetupGuide() {
            console.log("Showing server setup guide");
            // Intentar abrir el panel de ayuda si existe
            if (window.UIManager && typeof window.UIManager.showServerHelp === 'function') {
                window.UIManager.showServerHelp();
            } else {
                // Fallback básico
                console.warn("Server setup guide requested but UIManager not available");
            }
        }

        function updateServerStatusInUI(isOnline) {
            // Actualizar indicadores de estado en la UI si existen
            const statusIndicators = document.querySelectorAll(".server-status-indicator");
            statusIndicators.forEach(el => {
                el.dataset.status = isOnline ? "online" : "offline";
                el.title = isOnline ? "Server Online" : "Server Offline";
            });
        }

        function showServerOnlineMessage() {
            console.log("Server is back online");
        }

        return {
            preloadSubtitlesWithTimestamps,
            extractSubtitlesFromPlayerDataWithTimestamps,
            parseSubtitleXmlWithTimestamps,
            getYouTubeSubtitles,
            extractSubtitlesFromPlayerData,
            extractSubtitlesFromPage,
            parseSubtitleXml,
            checkServerStatus,
            getServerStatus: () => serverStatus,
            loadBackendPort,
            getBackendURL: () => BACKEND_URL,
        };
    })();

    console.log("Noticing Game: SubtitleExtraction module loaded successfully", window.SubtitleExtraction);
} catch (error) {
    console.error("Noticing Game: CRITICAL ERROR loading SubtitleExtraction module:", error);
    // Definir un objeto fallback para evitar que otros scripts fallen completamente
    window.SubtitleExtraction = {
        getYouTubeSubtitles: async () => {
            throw new Error("SubtitleExtraction module failed to load: " + error.message);
        },
        checkServerStatus: async () => false
    };
}
