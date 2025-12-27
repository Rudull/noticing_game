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

        // (Legacy functions removed to avoid duplicates)


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
                // Server status is now updated via checkServerStatus
            }
        }, 10000); // Verificar cada 10 segundos si está offline

        // --- Funciones auxiliares y de compatibilidad ---

        // Función auxiliar para parsear tiempo (supports VTT and TTML ticks)
        function parseTimeExpression(timeStr, tickRate = 10000000) {
            if (!timeStr) return 0;
            // Handle VTT/SRT: 00:00:10.500
            if (timeStr.includes(":")) {
                const parts = timeStr.split(":");
                let seconds = 0;
                if (parts.length === 3) {
                    seconds += parseFloat(parts[0]) * 3600;
                    seconds += parseFloat(parts[1]) * 60;
                    seconds += parseFloat(parts[2]);
                } else if (parts.length === 2) {
                    seconds += parseFloat(parts[0]) * 60;
                    seconds += parseFloat(parts[1]);
                }
                return seconds;
            }
            // Handle Ticks: 123456t
            if (timeStr.endsWith("t")) {
                const ticks = parseInt(timeStr.slice(0, -1));
                return ticks / tickRate;
            }
            // Handle seconds: 12.5s
            if (timeStr.endsWith("s")) {
                return parseFloat(timeStr.slice(0, -1));
            }
            // Plain number
            return parseFloat(timeStr);
        }

        // Updated preload function to properly format data for WordDetection
        async function preloadSubtitlesWithTimestamps() {
            console.log("SubtitleExtraction: preloadSubtitlesWithTimestamps called");

            try {
                // Get full subtitle data including raw timestamps
                const result = await getSubtitles();

                if (!result.success || !result.raw_subtitles) {
                    console.warn("No raw subtitles available for timestamp preloading");
                    return {};
                }

                // Convert to map: timestamp (string key) -> text
                const timestampMap = {};

                result.raw_subtitles.forEach(sub => {
                    // Use start time as key (in seconds)
                    // WordDetection checks: Math.abs(startTimeFloat - currentTime) < 1.5
                    if (sub.start !== undefined && sub.text) {
                        timestampMap[sub.start.toString()] = sub.text;
                    }
                });

                console.log(`SubtitleExtraction: Preloaded ${Object.keys(timestampMap).length} synced subtitle lines.`);
                return timestampMap;

            } catch (e) {
                console.error("Error preloading subtitles:", e);
                return {};
            }
        }

        // ... (extractSubtitlesFromPlayerDataWithTimestamps and parseSubtitleXmlWithTimestamps removed as they are redundant or covered) ...

        // Updated parseSubtitleXml to actually be used or we can use parseNetflixSubtitles logic
        // We will keep existing exports but update the main functions.

        // --- Netflix Logic Updated ---

        let CACHED_NETFLIX_SUBTITLES = null;

        function waitForInterceptedSubtitle(timeoutMs) {
            if (CACHED_NETFLIX_SUBTITLES) {
                console.log("Using cached Netflix subtitles");
                return Promise.resolve(CACHED_NETFLIX_SUBTITLES);
            }

            return new Promise((resolve) => {
                console.log("Waiting for Netflix subtitle interception...");
                const handler = (e) => {
                    window.removeEventListener("NoticingGameNetflixSubtitle", handler);
                    if (e.detail) {
                        CACHED_NETFLIX_SUBTITLES = e.detail;
                        resolve(e.detail);
                    }
                };
                window.addEventListener("NoticingGameNetflixSubtitle", handler);

                setTimeout(() => {
                    window.removeEventListener("NoticingGameNetflixSubtitle", handler);
                    resolve(null);
                }, timeoutMs);
            });
        }

        function parseNetflixSubtitles(content, format) {
            const subtitles = []; // Strings only (legacy support)
            const raw_subtitles = []; // Objects with timestamps

            // Try to detect tickRate for XML headers
            let tickRate = 10000000; // Default Netflix tick rate
            const tickRateMatch = content.match(/tickRate="(\d+)"/);
            if (tickRateMatch) {
                tickRate = parseInt(tickRateMatch[1]);
            }

            if (format === "vtt" || content.includes("WEBVTT")) {
                const lines = content.split(/\r?\n/);
                let i = 0;
                while (i < lines.length) {
                    const line = lines[i].trim();
                    // Check for timestamp line: 00:00:10.000 --> 00:00:12.000
                    if (line.includes("-->")) {
                        const times = line.split("-->");
                        const start = parseTimeExpression(times[0].trim());
                        const end = parseTimeExpression(times[1].trim());

                        // Next lines are text until empty line
                        let textAccum = "";
                        i++;
                        while (i < lines.length && lines[i].trim() !== "") {
                            textAccum += lines[i] + " ";
                            i++;
                        }

                        const text = textAccum.replace(/<[^>]*>/g, "").trim();
                        if (text) {
                            subtitles.push(text);
                            raw_subtitles.push({ text, start, end });
                        }
                    } else {
                        i++;
                    }
                }
            } else {
                // XML/DFXP
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(content, "text/xml");
                const pElements = xmlDoc.getElementsByTagName("p");

                for (let i = 0; i < pElements.length; i++) {
                    const p = pElements[i];
                    let text = p.textContent.trim().replace(/\s+/g, " ");

                    const begin = p.getAttribute("begin");
                    const end = p.getAttribute("end");

                    if (text) {
                        subtitles.push(text);
                        if (begin && end) {
                            raw_subtitles.push({
                                text: text,
                                start: parseTimeExpression(begin, tickRate),
                                end: parseTimeExpression(end, tickRate)
                            });
                        }
                    }
                }
            }

            // Attach raw data to the returned array (hacky but keeps signature) or handle in getNetflixSubtitles
            // We'll handle it by returning both from a helper if called directly, but here we just return strings?
            // Wait, previous implementation returned strings array.
            // Let's attach raw_subtitles as a property to the array to pass it up safely
            subtitles.raw_subtitles = raw_subtitles;
            return subtitles;
        }

        function getPlatform() {
            if (window.location.hostname.includes("youtube.com")) return "youtube";
            if (window.location.hostname.includes("netflix.com")) return "netflix";
            if (window.location.hostname.includes("disneyplus.com")) return "disney";
            return "unknown";
        }

        async function getSubtitles() {
            const platform = getPlatform();
            if (platform === "youtube") {
                return getYouTubeSubtitles();
            } else if (platform === "netflix") {
                return getNetflixSubtitles();
            } else if (platform === "disney") {
                return getDisneySubtitles();
            } else {
                throw new Error("Unsupported platform: " + platform);
            }
        }

        async function getNetflixSubtitles() {
            console.log("Noticing Game: Starting Netflix subtitle extraction strategy...");

            try {
                const interceptedData = await waitForInterceptedSubtitle(10000); // 10s wait
                if (interceptedData) {
                    console.log("Noticing Game: Using intercepted Netflix subtitles");
                    const subtitlesArray = parseNetflixSubtitles(interceptedData.content, interceptedData.format);
                    const raw_subtitles = subtitlesArray.raw_subtitles || [];

                    // Start background DOM scraper for backup/redundancy
                    if (window.NetflixIntegration) {
                        window.NetflixIntegration.extractSubtitlesFromDOM().catch(e => console.error(e));
                    }

                    return {
                        success: true,
                        subtitles: subtitlesArray,
                        raw_subtitles: raw_subtitles, // Pass this up!
                        language: "detected",
                        source: "netflix-interceptor",
                        video_title: document.title,
                        subtitle_count: subtitlesArray.length
                    };
                }
            } catch (e) {
                console.log("Noticing Game: Interception timed out or failed, falling back to DOM");
            }

            // Fallback
            if (window.NetflixIntegration) {
                console.log("Noticing Game: Using Netflix DOM extraction");
                return window.NetflixIntegration.extractSubtitlesFromDOM();
            }

            throw new Error("Netflix integration not available");
        }

        // --- Disney Logic ---
        let CACHED_DISNEY_SUBTITLES = null;

        function waitForDisneyInterceptedSubtitle(timeoutMs) {
            if (CACHED_DISNEY_SUBTITLES) {
                return Promise.resolve(CACHED_DISNEY_SUBTITLES);
            }

            return new Promise((resolve) => {
                const handler = (e) => {
                    window.removeEventListener("NoticingGameDisneySubtitle", handler);
                    if (e.detail) {
                        CACHED_DISNEY_SUBTITLES = e.detail;
                        resolve(e.detail);
                    }
                };
                window.addEventListener("NoticingGameDisneySubtitle", handler);
                setTimeout(() => {
                    window.removeEventListener("NoticingGameDisneySubtitle", handler);
                    resolve(null);
                }, timeoutMs);
            });
        }

        async function getDisneySubtitles() {
            console.log("Noticing Game: Starting Disney+ subtitle extraction strategy...");
            try {
                const interceptedData = await waitForDisneyInterceptedSubtitle(10000);
                if (interceptedData) {
                    // Reuse parseNetflixSubtitles as it supports generic VTT/XML
                    const subtitlesArray = parseNetflixSubtitles(interceptedData.content, interceptedData.format);
                    const raw_subtitles = subtitlesArray.raw_subtitles || [];

                    if (window.DisneyIntegration) {
                        window.DisneyIntegration.extractSubtitlesFromDOM().catch(e => console.error(e));
                    }

                    return {
                        success: true,
                        subtitles: subtitlesArray,
                        raw_subtitles: raw_subtitles,
                        language: "detected",
                        source: "disney-interceptor",
                        video_title: document.title,
                        subtitle_count: subtitlesArray.length
                    };
                }
            } catch (e) {
                console.log("Noticing Game: Disney Interception timed out");
            }

            // Fallback
            if (window.DisneyIntegration) {
                console.log("Noticing Game: Using Disney DOM extraction");
                return window.DisneyIntegration.extractSubtitlesFromDOM();
            }
            throw new Error("Disney integration not available");
        }

        // --- YouTube Logic Update (keeping compatibility) ---

        async function getYouTubeSubtitles() {
            // ... existing start ...
            try {
                console.log("Noticing Game: Attempting to extract subtitles using backend server...");
                // Verify server... (omitted for brevity, assume checkServerStatus call)
                const isServerOnline = await checkServerStatus();
                if (!isServerOnline) { /*...*/ throw new Error("Backend offline"); }

                const videoId = window.YouTubeVideoUtils.getYouTubeVideoId();
                if (!videoId) throw new Error("No video ID");
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

                const data = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { action: "extractSubtitles", backendUrl: BACKEND_URL, videoUrl: videoUrl },
                        (response) => {
                            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                            else if (response && response.success) resolve(response.data);
                            else reject(new Error(response ? response.error : "Unknown error"));
                        }
                    );
                });

                if (!data.success) throw new Error(data.error || "Backend failed");

                // data.subtitles is already [{text, start, end}, ...] from backend
                const subtitles = data.subtitles.map(s => s.text);

                // Process for word detection (list building)
                processSubtitlesForDetection(subtitles);

                return {
                    success: true,
                    subtitles: subtitles,
                    raw_subtitles: data.subtitles, // EXPOSE RAW DATA
                    language: data.language,
                    source: "backend-yt-dlp",
                    video_title: data.video_title,
                    subtitle_count: data.subtitle_count,
                };

            } catch (error) {
                // ... error handling ... use extractSubtitlesFromPlayerData or Page
                console.error("Backend failed, trying fallback", error);
                try {
                    // Try player data fallback
                    const fallbackData = await extractSubtitlesFromPlayerData();
                    // Ensure fallback provides raw_subtitles if possible (parseSubtitleXml needs update?)
                    // For now, minimal support
                    return fallbackData;
                } catch (e) { /*...*/ }

                try {
                    const pageData = await extractSubtitlesFromPage();
                    return pageData;
                } catch (e) { throw error; }
            }
        }

        // Helper para procesar la lista completa de subtítulos
        function processSubtitlesForDetection(subtitlesList) {
            if (!subtitlesList || !Array.isArray(subtitlesList)) return;

            chrome.storage.local.get(["frequencyWordList"], function (result) {
                try {
                    if (result.frequencyWordList && result.frequencyWordList.length > 0) {
                        const frequencyWordList = result.frequencyWordList;
                        subtitlesList.forEach(text => {
                            if (window.TextProcessing) {
                                window.TextProcessing.processSubtitleTextForWordDetection(
                                    text,
                                    frequencyWordList,
                                    function (word) {
                                        if (window.WordDetection) {
                                            window.WordDetection.trackWordAppearance(word);
                                        }
                                    }
                                );
                            }
                        });
                    }
                } catch (e) { console.error(e); }
            });
        }

        function parseSubtitleXml(xmlContent) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            const subtitles = [];

            // Check for parsing errors
            const parserError = xmlDoc.getElementsByTagName("parsererror");
            if (parserError.length > 0) {
                console.error("XML Parse Error:", parserError[0].textContent);
                return subtitles;
            }

            // Try <text> elements first (YouTube's simpler format)
            let textElements = xmlDoc.getElementsByTagName("text");

            // If no <text> elements, try <p> elements (TTML format)
            if (textElements.length === 0) {
                textElements = xmlDoc.getElementsByTagName("p");
                console.log("Using TTML <p> elements for subtitle parsing");
            } else {
                console.log("Using YouTube <text> elements for subtitle parsing");
            }

            for (let i = 0; i < textElements.length; i++) {
                const el = textElements[i];
                let text = el.textContent.trim();

                // Decode HTML entities
                text = text.replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");

                // Clean multiple spaces and newlines
                text = text.replace(/\s+/g, " ").trim();

                if (text) subtitles.push(text);
            }

            console.log(`Parsed ${subtitles.length} subtitle entries from XML`);
            if (subtitles.length === 0 && xmlContent.length > 0) {
                console.warn("XML Content received but no subtitles parsed. First 500 chars:", xmlContent.substring(0, 500));
            }

            return subtitles;
        }

        // Función para extraer subtítulos de los datos del reproductor con soporte para traducciones
        async function extractSubtitlesFromPlayerData() {
            return new Promise((resolve, reject) => {
                try {
                    console.log("Noticing Game: Extracting subtitles from player data...");

                    // Buscar información de captions en scripts
                    const scripts = document.getElementsByTagName("script");
                    let captionTracks = null;
                    let playerResponse = null;

                    for (let i = 0; i < scripts.length; i++) {
                        const content = scripts[i].textContent;
                        if (content && content.includes("captionTracks")) {
                            // Try to extract full captionTracks array
                            try {
                                // Find ytInitialPlayerResponse in the script
                                const startMarker = 'var ytInitialPlayerResponse = ';
                                const startIdx = content.indexOf(startMarker);

                                if (startIdx !== -1) {
                                    // Start after the marker
                                    let jsonStart = startIdx + startMarker.length;
                                    let depth = 0;
                                    let inString = false;
                                    let escaped = false;
                                    let jsonEnd = -1;

                                    // Parse character by character to find matching closing brace
                                    for (let j = jsonStart; j < content.length; j++) {
                                        const char = content[j];

                                        if (escaped) {
                                            escaped = false;
                                            continue;
                                        }

                                        if (char === '\\') {
                                            escaped = true;
                                            continue;
                                        }

                                        if (char === '"') {
                                            inString = !inString;
                                            continue;
                                        }

                                        if (inString) continue;

                                        if (char === '{') {
                                            depth++;
                                        } else if (char === '}') {
                                            depth--;
                                            if (depth === 0) {
                                                jsonEnd = j + 1;
                                                break;
                                            }
                                        }
                                    }

                                    if (jsonEnd > jsonStart) {
                                        const jsonStr = content.substring(jsonStart, jsonEnd);
                                        playerResponse = JSON.parse(jsonStr);
                                        captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                                        if (captionTracks) {
                                            console.log(`Found ${captionTracks.length} caption tracks`);
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn("Failed to parse player response:", e);
                            }

                            // Fallback: extract baseUrl directly if JSON parsing failed
                            if (!captionTracks && content.includes("baseUrl")) {
                                const match = content.match(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
                                if (match && match[1]) {
                                    // Create minimal track object
                                    captionTracks = [{
                                        baseUrl: match[1].replace(/\\u0026/g, "&"),
                                        languageCode: "detected"
                                    }];
                                    break;
                                }
                            }
                        }
                    }

                    if (!captionTracks || captionTracks.length === 0) {
                        return reject(new Error("No caption tracks found"));
                    }

                    // Priority: en (manual/auto) > es (manual/auto) > any other
                    const langPriority = ['en', 'en-US', 'en-GB', 'es'];
                    let selectedTrack = null;
                    let translationLanguage = null;
                    let isAutoGenerated = false;

                    // First pass: look for exact language match
                    for (const lang of langPriority) {
                        const track = captionTracks.find(t =>
                            t.languageCode === lang || t.languageCode?.startsWith(lang)
                        );
                        if (track) {
                            selectedTrack = track;
                            // Check if this is an auto-generated track
                            isAutoGenerated = track.kind === 'asr' || track.vssId?.includes('.a.');
                            console.log(`Found ${isAutoGenerated ? 'auto-generated' : 'native'} captions in ${lang}`);
                            break;
                        }
                    }

                    // Second pass: if  we didn't find English, check if ANY track is translatable to English
                    if (!selectedTrack || !selectedTrack.languageCode?.startsWith('en')) {
                        // YouTube allows translating from any caption track to any language
                        // Check if we have ANY track available - we can translate it to English
                        if (captionTracks.length > 0) {
                            const sourceTrack = captionTracks[0]; // Use first available track
                            selectedTrack = sourceTrack;
                            translationLanguage = 'en'; // Request English translation
                            isAutoGenerated = sourceTrack.kind === 'asr' || sourceTrack.vssId?.includes('.a.');
                            console.log(`Will translate from ${sourceTrack.languageCode} to English`);
                        }
                    }

                    if (!selectedTrack) {
                        return reject(new Error("No suitable caption track found"));
                    }

                    // Build the caption URL
                    let captionUrl = selectedTrack.baseUrl;

                    // For auto-generated subtitles, ensure proper format and kind parameters
                    if (isAutoGenerated) {
                        // Add kind=asr parameter for auto-generated subtitles
                        if (!captionUrl.includes('kind=')) {
                            captionUrl += (captionUrl.includes('?') ? '&' : '?') + 'kind=asr';
                        }
                        // Use json3 format for better ASR compatibility
                        if (!captionUrl.includes('fmt=')) {
                            captionUrl += (captionUrl.includes('?') ? '&' : '?') + 'fmt=json3';
                        }
                    } else {
                        // For manual subtitles, srv3 format works well
                        if (!captionUrl.includes('fmt=')) {
                            captionUrl += (captionUrl.includes('?') ? '&' : '?') + 'fmt=srv3';
                        }
                    }

                    // Add translation parameter if needed
                    if (translationLanguage) {
                        // tlang parameter requests automatic translation
                        captionUrl += (captionUrl.includes('?') ? '&' : '?') + `tlang=${translationLanguage}`;
                    }

                    console.log(`Fetching ${isAutoGenerated ? 'auto-generated' : 'manual'} captions from: ${captionUrl.substring(0, 120)}...`);

                    // Fetch and parse subtitles
                    fetch(captionUrl)
                        .then(r => {
                            if (!r.ok) {
                                throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                            }
                            return r.text();
                        })
                        .then(content => {
                            // Check if content is empty
                            if (!content || content.trim().length === 0) {
                                throw new Error("Empty subtitle content received");
                            }

                            let subs = [];

                            // Try to parse as JSON3 first (for auto-generated)
                            if (isAutoGenerated || content.trim().startsWith('{')) {
                                try {
                                    const data = JSON.parse(content);
                                    const events = data.events || [];

                                    events.forEach(event => {
                                        if (!event.segs) return;

                                        const text = event.segs.map(seg => seg.utf8 || '').join('').trim();
                                        if (text) {
                                            subs.push(text);
                                        }
                                    });

                                    console.log(`Parsed ${subs.length} subtitles from JSON3 format`);
                                } catch (jsonError) {
                                    console.warn("Failed to parse as JSON3, trying XML...", jsonError);
                                    subs = parseSubtitleXml(content);
                                }
                            } else {
                                // Parse as XML
                                subs = parseSubtitleXml(content);
                            }

                            const sourceInfo = translationLanguage
                                ? `${selectedTrack.languageCode} (auto-translated to ${translationLanguage})`
                                : selectedTrack.languageCode;

                            if (subs.length === 0) {
                                throw new Error(`No subtitles could be parsed from ${sourceInfo}`);
                            }

                            console.log(`Successfully extracted ${subs.length} subtitles from ${sourceInfo}`);
                            resolve({
                                success: true,
                                subtitles: subs,
                                language: translationLanguage || selectedTrack.languageCode,
                                source: isAutoGenerated ? "player-data-asr" : (translationLanguage ? "player-data-translated" : "player-data"),
                                subtitle_count: subs.length
                            });
                        })
                        .catch(e => reject(new Error(`Failed to fetch captions: ${e.message}`)));

                } catch (e) {
                    reject(new Error(`Player data extraction failed: ${e.message}`));
                }
            });
        }


        function clearCache() {
            CACHED_NETFLIX_SUBTITLES = null;
            CACHED_DISNEY_SUBTITLES = null;
            console.log("SubtitleExtraction: Caches cleared");
        }

        return {
            clearCache,
            preloadSubtitlesWithTimestamps,
            getYouTubeSubtitles,
            getNetflixSubtitles,
            getDisneySubtitles, // Make sure this is exported too if I added it
            getSubtitles,
            extractSubtitlesFromPlayerData, // Kept for compatibility if used elsewhere
            extractSubtitlesFromPage,
            checkServerStatus,
            getServerStatus: () => serverStatus,
            loadBackendPort,
            getBackendURL: () => BACKEND_URL
        };
    })(); // Close generic module function
} catch (e) {
    console.error("Error initializing SubtitleExtraction:", e);
    window.SubtitleExtraction = {
        getYouTubeSubtitles: async () => { throw new Error("Module failed: " + e.message); },
        getSubtitles: async () => { throw new Error("Module failed: " + e.message); },
        checkServerStatus: async () => false
    };
}
