// Módulo para extraer y parsear subtítulos de YouTube
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
                "✅ El servidor está en línea. Puedes usar la extensión normalmente.";
            element.style.color = "green";

            setTimeout(() => {
                element.textContent = originalText;
                element.style.color = "";
            }, 4000);
        });
    }

    // User-friendly server setup guide in English for non-technical users
    function showServerSetupGuide() {
        if (serverStatus.hasShownOfflineMessage) {
            return; // Don't show multiple times
        }

        serverStatus.hasShownOfflineMessage = true;

        // Replace this link with your real download link
        const downloadLink = "https://github.com/Rudull/noticing_game";

        const setupInstructionsHtml = `
⚠️ To use Noticing Game, you need to install and run the Subtitle Server.<br><br>

<b>What is this?</b><br>
The server is a small, safe program that helps the extension get subtitles from YouTube videos. It only runs on your computer.<br><br>

<b>What should you do?</b><br>
1️⃣ If you have NOT installed the server yet:<br>
   • <a href="${downloadLink}" target="_blank" rel="noopener noreferrer">Descargar</a><br><br>
2️⃣ If you already installed it:<br>
   • Make sure the server is RUNNING.<br>
   • If you see this message, the server is probably off.<br><br>

<b>How to make the server start automatically?</b><br>
• During installation, you can choose to start the server automatically every time you turn on your computer.<br>
• If you already installed it, look for an option like "Start with Windows/Mac/Linux" in the installer or server settings.<br><br>

<b>Where do I find it?</b><br>
• Look for the Noticing Game icon near your clock (system tray) or menu bar.<br>
• If you don't see it, open the server manually from your Start menu or Applications folder.<br><br>

<b>Need help?</b><br>
• You only need to install and run the server once.<br>
• For help, check the quick guide included with the installer or on the download page.<br><br>

Once the server is running, refresh this page and you can use the extension normally.
    `.trim();

        // Modal visual mejorado
        const modal = document.createElement("div");
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100vw";
        modal.style.height = "100vh";
        modal.style.background = "rgba(0,0,0,0.45)";
        modal.style.zIndex = "99999";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.animation = "fadeIn 0.3s";

        const content = document.createElement("div");
        content.style.background = "var(--ng-modal-bg, #fff)";
        content.style.padding = "32px 28px 24px 28px";
        content.style.borderRadius = "12px";
        content.style.maxWidth = "420px";
        content.style.width = "90%";
        content.style.boxShadow = "0 4px 32px rgba(0,0,0,0.18)";
        content.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        content.style.position = "relative";
        content.style.textAlign = "left";
        content.style.fontSize = "1.5em";
        content.style.color = "var(--ng-modal-fg, #222)";

        // Icono de advertencia
        const icon = document.createElement("div");
        icon.innerHTML = "&#9888;"; // ⚠️
        icon.style.fontSize = "32px";
        icon.style.color = "#ff9800";
        icon.style.marginBottom = "12px";
        icon.style.textAlign = "center";
        content.appendChild(icon);

        // Botón de cerrar (X)
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "12px";
        closeBtn.style.right = "16px";
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.fontSize = "22px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "#888";
        closeBtn.onmouseover = () => (closeBtn.style.color = "#000");
        closeBtn.onmouseout = () => (closeBtn.style.color = "#888");
        closeBtn.onclick = () => document.body.removeChild(modal);
        content.appendChild(closeBtn);

        // Instrucciones (usa tu HTML aquí)
        const instructions = document.createElement("div");
        // Resalta el texto principal con fuente más grande
        // Busca el texto principal y reemplázalo por un h2 destacado
        let html = setupInstructionsHtml.replace(
            /^⚠️ To use Noticing Game, you need to install and run the Subtitle Server\.<br><br>/,
            '<h2 style="font-size:1.7em; margin-top:0; margin-bottom:0.7em; font-weight:bold;">To use Noticing Game, you need to install and run the Subtitle Server.</h2>',
        );
        instructions.innerHTML = html;
        content.appendChild(instructions);

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Animación CSS y tema adaptativo
        const style = document.createElement("style");
        style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    /* Tema claro por defecto */
    :root {
      --ng-modal-bg: #fff;
      --ng-modal-fg: #222;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ng-modal-bg: #23272e;
        --ng-modal-fg: #f1f1f1;
      }
    }
    `;
        document.head.appendChild(style);

        // Also show in the extension UI if available
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );
        statusElements.forEach((element) => {
            element.innerHTML = `
        <div style="color: orange; font-weight: bold; margin-bottom: 10px;">
            🔌 Subtitle Server required for Noticing Game
        </div>
        <div style="font-size: 13px; line-height: 1.5;">
            To use the extension, please follow these steps:
            <ol style="margin: 8px 0 8px 20px; padding: 0;">
                <li>
                    <b>Download the server:</b>
                    <a href="${downloadLink}" target="_blank" style="color: #1976d2; text-decoration: underline;">Download Noticing Game Server</a>
                </li>
                <li>
                    <b>Install and run the server</b> following the instructions.
                </li>
                <li>
                    <b>Recommended:</b> Choose the option to start the server automatically with your computer.
                </li>
                <li>
                    Once the server is running, <b>refresh this page</b>.
                </li>
            </ol>
            <div style="margin-top: 8px;">
                <b>Where do I find it?</b><br>
                Look for the Noticing Game icon near your clock (system tray) or menu bar.<br>
                If you don't see it, open the server manually from your Start menu or Applications folder.
            </div>
            <div style="margin-top: 8px;">
                <b>Need help?</b><br>
                • You only need to install and run the server once.<br>
                • For help, check the quick guide included with the installer or on the download page.
            </div>
        </div>
      `;
        });
    }

    // Show server status in the UI (in English)
    function updateServerStatusInUI(isOnline) {
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );

        if (!isOnline) {
            statusElements.forEach((element) => {
                if (!element.textContent.includes("Subtitle Server")) {
                    element.innerHTML = `
            <div style="color: orange;">
                ⚠️ The Subtitle Server is not running. Click "Play" to see how to install and start it.
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
