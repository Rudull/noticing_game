// Módulo para extraer y parsear subtítulos de YouTube
window.SubtitleExtraction = (function () {
    // URL del servidor backend
    const BACKEND_URL = "http://localhost:5000";

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

        try {
            const response = await fetch(`${BACKEND_URL}/`, {
                method: "GET",
                timeout: 3000,
            });

            if (response.ok) {
                const data = await response.json();
                serverStatus.isOnline = data.status === "running";
                serverStatus.lastCheck = now;

                if (
                    serverStatus.isOnline &&
                    serverStatus.hasShownOfflineMessage
                ) {
                    showServerOnlineMessage();
                    serverStatus.hasShownOfflineMessage = false;
                }

                return serverStatus.isOnline;
            }
        } catch (error) {
            console.log("Server check failed:", error.message);
        }

        serverStatus.isOnline = false;
        serverStatus.lastCheck = now;
        return false;
    }

    // Función para mostrar mensaje cuando el servidor vuelve a estar online
    function showServerOnlineMessage() {
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );
        statusElements.forEach((element) => {
            const originalText = element.textContent;
            element.textContent =
                "✅ Backend server is now online! You can use the extension normally.";
            element.style.color = "green";

            setTimeout(() => {
                element.textContent = originalText;
                element.style.color = "";
            }, 4000);
        });
    }

    // Función para mostrar guía detallada al usuario
    function showServerSetupGuide() {
        if (serverStatus.hasShownOfflineMessage) {
            return; // No mostrar múltiples veces
        }

        serverStatus.hasShownOfflineMessage = true;

        const setupInstructions = `
🎮 NOTICING GAME - SETUP REQUIRED

The subtitle extraction server is not running. To use this extension, you need to start the backend server:

📋 QUICK SETUP:

1️⃣ DOWNLOAD PYTHON (if not installed):
   • Visit: https://www.python.org/downloads/
   • ✅ IMPORTANT: Check "Add Python to PATH"

2️⃣ START THE SERVER:
   • Navigate to the extension's backend folder
   • Run one of these commands:

   Windows:
   start_server.bat

   Mac/Linux:
   ./start_server.sh --auto-install

   Or manually:
   python subtitle_server.py

3️⃣ VERIFY:
   • Server should start on http://localhost:5000
   • Keep the server running while using the extension

💡 ALTERNATIVE SETUP:
   • Double-click start_server.py
   • Or run: python start_server.py --auto-install

⚠️  NEED HELP?
   • Check the README.md file in the backend folder
   • The server must run locally on your computer
   • This is required due to YouTube's security restrictions

Once the server is running, refresh this page and try again!
        `.trim();

        alert(setupInstructions);

        // También mostrar en la UI de la extensión si está disponible
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );
        statusElements.forEach((element) => {
            element.innerHTML = `
                <div style="color: orange; font-weight: bold; margin-bottom: 10px;">
                    🔧 Backend Server Required
                </div>
                <div style="font-size: 12px; line-height: 1.4;">
                    The subtitle extraction server is not running.<br>
                    <strong>Quick setup:</strong><br>
                    1. Install Python (python.org)<br>
                    2. Run: start_server.bat (Windows) or start_server.sh (Mac/Linux)<br>
                    3. Refresh this page<br><br>
                    <em>Check the extension's backend folder for detailed instructions.</em>
                </div>
            `;
        });
    }

    // Función para mostrar estado del servidor en la UI
    function updateServerStatusInUI(isOnline) {
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );

        if (!isOnline) {
            statusElements.forEach((element) => {
                if (!element.textContent.includes("Backend Server Required")) {
                    element.innerHTML = `
                        <div style="color: orange;">
                            ⚠️ Backend server offline - Click "Play" for setup instructions
                        </div>
                    `;
                }
            });
        }
    }

    // Función para precargar subtítulos con timestamps
    async function preloadSubtitlesWithTimestamps() {
        try {
            // Obtener el ID del video actual
            const videoId = window.YouTubeVideoUtils.getYouTubeVideoId();
            if (!videoId) {
                throw new Error("No video ID found");
            }

            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            // Llamar al backend para obtener subtítulos
            const response = await fetch(`${BACKEND_URL}/extract-subtitles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: videoUrl }),
            });

            if (!response.ok) {
                throw new Error(`Backend server error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Backend extraction failed");
            }

            // Almacenar subtítulos organizados por timestamps para acceso rápido
            const subtitlesMap = {};

            if (data.subtitles && Array.isArray(data.subtitles)) {
                // Organizar subtítulos por tiempo de inicio
                data.subtitles.forEach((subtitle) => {
                    if (subtitle.start !== undefined) {
                        subtitlesMap[subtitle.start] = subtitle.text;
                    }
                });

                console.log(
                    `Noticing Game: Preloaded ${Object.keys(subtitlesMap).length} subtitles with timestamps from backend`,
                );
                return subtitlesMap;
            }

            return null;
        } catch (error) {
            console.error("Error preloading subtitles with timestamps:", error);
            // Si el backend no está disponible, mostrar un mensaje claro
            if (
                error.message.includes("Failed to fetch") ||
                error.message.includes("ECONNREFUSED")
            ) {
                console.error(
                    "Backend server appears to be offline. Please start the subtitle server.",
                );
            }
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
                        // Parsear subtítulos con timestamps
                        const subtitlesWithTime =
                            parseSubtitleXmlWithTimestamps(content);
                        resolve({
                            success: true,
                            subtitles: subtitlesWithTime,
                            language: selectedTrack.languageCode,
                            source: "player-data-with-timestamps",
                        });
                    })
                    .catch((error) => {
                        throw new Error(
                            `Error downloading subtitles: ${error.message}`,
                        );
                    });
            } catch (error) {
                console.error(
                    "Error extracting player data with timestamps:",
                    error,
                );
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
                const startTime = parseFloat(
                    element.getAttribute("start") || 0,
                );
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

            // Llamar al backend para obtener subtítulos
            const response = await fetch(`${BACKEND_URL}/extract-subtitles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: videoUrl }),
                timeout: 30000, // 30 segundos timeout
            });

            if (!response.ok) {
                if (response.status === 400) {
                    const errorData = await response.json();
                    throw new Error(
                        errorData.error || "Bad request to backend",
                    );
                }
                throw new Error(`Backend server error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                // Si el backend dice que no hay subtítulos, mostrar alerta
                if (
                    data.error &&
                    data.error.includes("No subtitles available")
                ) {
                    alert(
                        "This video doesn't have subtitles. Please choose a video with subtitles (either auto-generated or manual) to use Noticing Game.",
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
                                ⚠️ Using fallback mode - Limited functionality
                            </div>
                            <div style="font-size: 12px;">
                                For full features, please start the backend server
                            </div>
                        `;
                    });

                    return fallbackResult;
                } catch (fallbackError) {
                    throw new Error(
                        `Backend server offline. Please start the server for full functionality. Setup guide has been shown.`,
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

    // Verificar estado del servidor periódicamente
    setInterval(async () => {
        if (!serverStatus.isOnline) {
            await checkServerStatus();
            if (serverStatus.isOnline) {
                updateServerStatusInUI(true);
            }
        }
    }, 10000); // Verificar cada 10 segundos si está offline

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
    };
})();
