// Módulo para detectar y rastrear palabras en los subtítulos
window.WordDetection = (function () {
    // Constantes
    const WORD_VALIDITY_WINDOW = 5000; // 5 segundos en milisegundos

    // Estado interno
    const recentWords = {}; // Ya no almacenará solo timestamps, sino objetos con más datos

    // Palabras que ya han sido notadas en su aparición actual
    const notedWords = {};

    // Registrar una palabra como recientemente vista
    function trackWordAppearance(word, timestamp = Date.now()) {
        word = word.toLowerCase().trim();

        // Si la palabra ya estaba siendo rastreada, solo actualizar su timestamp
        if (recentWords[word]) {
            recentWords[word].timestamp = timestamp;
            // Resetear el estado de "notada" para esta nueva aparición
            notedWords[word] = false;
        } else {
            // Primera aparición de la palabra
            recentWords[word] = {
                timestamp: timestamp,
                notedInThisAppearance: false,
            };
            notedWords[word] = false;
        }

        console.log(`Word registered: "${word}" at time ${timestamp}`);

        // Limpiar palabras antiguas después del período de validez
        setTimeout(() => {
            if (
                recentWords[word] &&
                recentWords[word].timestamp === timestamp
            ) {
                console.log(`Removing expired word: "${word}"`);
                delete recentWords[word];
                delete notedWords[word];
            }
        }, WORD_VALIDITY_WINDOW + 100);
    }

    // Verificar si una palabra está en la lista de palabras recientes
    function isWordRecent(word) {
        word = word.toLowerCase().trim();
        const now = Date.now();

        if (!recentWords[word])
            return { isRecent: false, timeDiff: null, alreadyNoted: false };

        const timeDiff = now - recentWords[word].timestamp;
        const isRecent = timeDiff <= WORD_VALIDITY_WINDOW;
        const alreadyNoted = notedWords[word];

        console.log(
            `Checking word: "${word}" - Is recent?: ${isRecent ? "YES" : "NO"} - Time diff: ${timeDiff}ms - Already noted: ${alreadyNoted}`,
        );

        return { isRecent, timeDiff, alreadyNoted };
    }

    // Marcar una palabra como notada
    function markWordAsNoted(word) {
        word = word.toLowerCase().trim();
        if (recentWords[word]) {
            notedWords[word] = true;
        }
    }

    // Función para simular apariciones de palabras (para pruebas)
    function simulateWordsForTesting() {
        const testWords = ["the", "be", "and", "of", "a", "in", "to", "have"];
        testWords.forEach((word) => trackWordAppearance(word));
        console.log("Test words simulated:", testWords);
        console.log("Current state of recentWords:", recentWords);
    }

    // Configurar observador de subtítulos visibles
    function setupSubtitleObserver() {
        console.log("Setting up visible subtitle observer...");

        // Función para procesar subtítulos cuando aparecen
        function processVisibleSubtitles() {
            const subtitleElements = document.querySelectorAll(
                ".ytp-caption-segment",
            );

            if (subtitleElements && subtitleElements.length > 0) {
                const currentText = Array.from(subtitleElements)
                    .map((el) => el.textContent)
                    .join(" ");

                if (currentText.trim().length > 0) {
                    console.log("Subtitle detected:", currentText);

                    // Procesar palabras
                    const words = currentText
                        .toLowerCase()
                        // Reemplazar puntuación con espacios, pero mantener la estructura de palabra
                        .replace(/[.,?!;()\[\]{}:\/\\]/g, " ")
                        .replace(/"/g, " ")
                        .replace(/'/g, " ")
                        .split(/\s+/)
                        .filter((w) => w.length > 0);

                    // Obtener palabras de frecuencia y registrarlas
                    chrome.storage.local.get(
                        ["frequencyWordList"],
                        function (result) {
                            if (
                                result.frequencyWordList &&
                                result.frequencyWordList.length > 0
                            ) {
                                const frequencyWordList =
                                    result.frequencyWordList;

                                words.forEach((word) => {
                                    if (frequencyWordList.includes(word)) {
                                        trackWordAppearance(word);
                                        console.log(
                                            `Word detected in real-time: "${word}"`,
                                        );
                                    }
                                });
                            }
                        },
                    );
                }
            }
        }

        // Verificar subtítulos cada segundo
        const intervalId = setInterval(processVisibleSubtitles, 1000);
        window.noticingGameSubtitleInterval = intervalId;

        // Iniciar detección inmediatamente
        processVisibleSubtitles();

        // Para pruebas: simular palabras en entorno de desarrollo
        if (
            location.hostname === "localhost" ||
            location.hostname === "127.0.0.1"
        ) {
            simulateWordsForTesting();
        }
    }

    // Configurar detección de subtítulos ocultos
    function setupHiddenSubtitleDetection() {
        console.log("Setting up hidden subtitle detection...");

        // Cargar subtítulos con timestamps
        let subtitlesWithTimestamps = null;
        let lastProcessedTime = -1;

        // Usar la función del módulo de extracción
        if (window.SubtitleExtraction) {
            window.SubtitleExtraction.preloadSubtitlesWithTimestamps().then(
                (result) => {
                    subtitlesWithTimestamps = result;
                    console.log(
                        "Subtitles with timestamps loaded successfully",
                    );
                },
            );
        }

        // Función para verificar el tiempo actual y activar subtítulos
        function checkVideoTimeAndProcessSubtitles() {
            if (!subtitlesWithTimestamps) return;

            const videoElement = document.querySelector("video");
            if (!videoElement) return;

            const currentTime = Math.floor(videoElement.currentTime);

            // Solo procesar si cambiamos de segundo
            if (currentTime !== lastProcessedTime) {
                lastProcessedTime = currentTime;

                // Buscar subtítulos que correspondan al tiempo actual
                Object.keys(subtitlesWithTimestamps).forEach((startTime) => {
                    if (Math.abs(parseFloat(startTime) - currentTime) < 1.5) {
                        const subtitleText = subtitlesWithTimestamps[startTime];
                        processSubtitleText(subtitleText);
                    }
                });
            }
        }

        // Procesar texto de subtítulos para detectar palabras de la lista
        function processSubtitleText(text) {
            if (!text) return;

            console.log("Processing hidden subtitle:", text);

            // Extraer palabras y compararlas con la lista de frecuencia
            const words = text
                .toLowerCase()
                // Reemplazar puntuación con espacios, pero mantener la estructura de palabra
                .replace(/[.,?!;()\[\]{}:\/\\]/g, " ")
                .replace(/"/g, " ")
                .replace(/'/g, " ")
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
                            trackWordAppearance(word);
                            console.log(
                                `Word detected from hidden subtitles: "${word}"`,
                            );
                        }
                    });
                }
            });
        }

        // Iniciar monitoreo de tiempo de video
        const intervalId = setInterval(checkVideoTimeAndProcessSubtitles, 250);
        window.noticingGameHiddenSubtitleInterval = intervalId;
    }

    // Retornar API pública
    return {
        WORD_VALIDITY_WINDOW,
        recentWords,
        notedWords,
        trackWordAppearance,
        isWordRecent,
        markWordAsNoted,
        simulateWordsForTesting,
        setupSubtitleObserver,
        setupHiddenSubtitleDetection,
    };
})();
