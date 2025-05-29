// Módulo para detectar y rastrear palabras en los subtítulos
window.WordDetection = (function () {
    // Constantes
    const WORD_VALIDITY_WINDOW = 5000; // 5 segundos en milisegundos

    // Estado interno
    const recentWords = {}; // Ya no almacenará solo timestamps, sino objetos con más datos

    // Palabras que ya han sido notadas en su aparición actual
    const notedWords = {};

    // Referencias a intervalos para limpieza
    let subtitleObserverInterval = null;
    let hiddenSubtitleInterval = null;

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
                console.warn('Chrome runtime error detected:', chrome.runtime.lastError.message);
                return false;
            }
            
            return true;
        } catch (error) {
            console.warn('Extension context validation error:', error);
            return false;
        }
    }

    // Función para manejar contexto invalidado
    function handleInvalidContext() {
        console.log('Extension context invalidated, cleaning up...');
        
        // Limpiar intervalos
        clearIntervals();
        
        // Limpiar datos
        Object.keys(recentWords).forEach(key => delete recentWords[key]);
        Object.keys(notedWords).forEach(key => delete notedWords[key]);
        
        // Notificar al usuario si es posible
        try {
            const statusElements = document.querySelectorAll('.noticing-game-status');
            statusElements.forEach(element => {
                element.textContent = 'Extension reloaded. Please refresh the page to continue using Noticing Game.';
                element.style.color = 'orange';
            });
        } catch (error) {
            console.warn('Could not update status elements:', error);
        }
    }

    // Registrar una palabra como recientemente vista
    function trackWordAppearance(word, timestamp = Date.now()) {
        // Validar entrada
        if (!word || typeof word !== 'string') {
            console.warn('Invalid word provided to trackWordAppearance:', word);
            return false;
        }

        word = word.toLowerCase().trim();
        
        // Validar timestamp
        if (typeof timestamp !== 'number' || timestamp <= 0) {
            timestamp = Date.now();
        }

        try {
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
                try {
                    if (
                        recentWords[word] &&
                        recentWords[word].timestamp === timestamp
                    ) {
                        console.log(`Removing expired word: "${word}"`);
                        delete recentWords[word];
                        delete notedWords[word];
                    }
                } catch (error) {
                    console.error('Error cleaning expired word:', error);
                }
            }, WORD_VALIDITY_WINDOW + 100);

            return true;
        } catch (error) {
            console.error('Error tracking word appearance:', error);
            return false;
        }
    }

    // Verificar si una palabra está en la lista de palabras recientes
    function isWordRecent(word) {
        // Validar entrada
        if (!word || typeof word !== 'string') {
            console.warn('Invalid word provided to isWordRecent:', word);
            return { isRecent: false, timeDiff: null, alreadyNoted: false };
        }

        try {
            word = word.toLowerCase().trim();
            const now = Date.now();

            if (!recentWords[word])
                return { isRecent: false, timeDiff: null, alreadyNoted: false };

            const timeDiff = now - recentWords[word].timestamp;
            const isRecent = timeDiff <= WORD_VALIDITY_WINDOW;
            const alreadyNoted = notedWords[word] || false;

            console.log(
                `Checking word: "${word}" - Is recent?: ${isRecent ? "YES" : "NO"} - Time diff: ${timeDiff}ms - Already noted: ${alreadyNoted}`,
            );

            return { isRecent, timeDiff, alreadyNoted };
        } catch (error) {
            console.error('Error checking if word is recent:', error);
            return { isRecent: false, timeDiff: null, alreadyNoted: false };
        }
    }

    // Marcar una palabra como notada
    function markWordAsNoted(word) {
        // Validar entrada
        if (!word || typeof word !== 'string') {
            console.warn('Invalid word provided to markWordAsNoted:', word);
            return false;
        }

        try {
            word = word.toLowerCase().trim();
            if (recentWords[word]) {
                notedWords[word] = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error marking word as noted:', error);
            return false;
        }
    }

    // Función para simular apariciones de palabras (para pruebas)
    function simulateWordsForTesting() {
        const testWords = ["the", "be", "and", "of", "a", "in", "to", "have"];
        testWords.forEach((word) => trackWordAppearance(word));
        console.log("Test words simulated:", testWords);
        console.log("Current state of recentWords:", recentWords);
    }

    // Limpiar intervalos existentes
    function clearIntervals() {
        if (subtitleObserverInterval) {
            clearInterval(subtitleObserverInterval);
            subtitleObserverInterval = null;
        }
        if (hiddenSubtitleInterval) {
            clearInterval(hiddenSubtitleInterval);
            hiddenSubtitleInterval = null;
        }
        // También limpiar referencias globales
        if (window.noticingGameSubtitleInterval) {
            clearInterval(window.noticingGameSubtitleInterval);
            window.noticingGameSubtitleInterval = null;
        }
        if (window.noticingGameHiddenSubtitleInterval) {
            clearInterval(window.noticingGameHiddenSubtitleInterval);
            window.noticingGameHiddenSubtitleInterval = null;
        }
    }

    // Configurar observador de subtítulos visibles
    function setupSubtitleObserver() {
        console.log("Setting up visible subtitle observer...");

        // Limpiar intervalos existentes primero
        clearIntervals();

        // Función para procesar subtítulos cuando aparecen
        function processVisibleSubtitles() {
            try {
                // Verificar contexto al inicio de cada procesamiento
                if (!isExtensionContextValid()) {
                    handleInvalidContext();
                    return;
                }

                const subtitleElements = document.querySelectorAll(
                    ".ytp-caption-segment",
                );

                if (subtitleElements && subtitleElements.length > 0) {
                    const currentText = Array.from(subtitleElements)
                        .map((el) => el.textContent || "")
                        .join(" ");

                    if (currentText.trim().length > 0) {
                        console.log("Subtitle detected:", currentText);

                        // Verificar contexto antes de usar Chrome APIs
                        if (!isExtensionContextValid()) {
                            handleInvalidContext();
                            return;
                        }

                        // Obtener palabras de frecuencia y registrarlas
                        chrome.storage.local.get(
                            ["frequencyWordList"],
                            function (result) {
                                try {
                                    // Verificar contexto nuevamente en el callback
                                    if (!isExtensionContextValid()) {
                                        handleInvalidContext();
                                        return;
                                    }

                                    if (
                                        result.frequencyWordList &&
                                        result.frequencyWordList.length > 0
                                    ) {
                                        const frequencyWordList =
                                            result.frequencyWordList;

                                        // Usar la función centralizada para procesar el texto
                                        if (window.TextProcessing && 
                                            typeof window.TextProcessing.processSubtitleTextForWordDetection === 'function') {
                                            window.TextProcessing.processSubtitleTextForWordDetection(
                                                currentText,
                                                frequencyWordList,
                                                function (word) {
                                                    trackWordAppearance(word);
                                                    console.log(
                                                        `Word detected in real-time: "${word}"`,
                                                    );
                                                },
                                            );
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error processing subtitles:', error);
                                    // Si el error es por contexto invalidado, manejar
                                    if (error.message && error.message.includes('Extension context invalidated')) {
                                        handleInvalidContext();
                                    }
                                }
                            },
                        );
                    }
                }
            } catch (error) {
                console.error('Error in processVisibleSubtitles:', error);
            }
        }

        // Verificar subtítulos cada segundo
        subtitleObserverInterval = setInterval(processVisibleSubtitles, 1000);
        window.noticingGameSubtitleInterval = subtitleObserverInterval;

        // Iniciar detección inmediatamente
        processVisibleSubtitles();

        // Para pruebas: simular palabras en entorno de desarrollo
        if (
            location.hostname === "localhost" ||
            location.hostname === "127.0.0.1"
        ) {
            simulateWordsForTesting();
        }

        return true;
    }

    // Configurar detección de subtítulos ocultos
    function setupHiddenSubtitleDetection() {
        console.log("Setting up hidden subtitle detection...");

        // Limpiar intervalos existentes primero
        clearIntervals();

        // Cargar subtítulos con timestamps
        let subtitlesWithTimestamps = null;
        let lastProcessedTime = -1;

        // Usar la función del módulo de extracción
        if (window.SubtitleExtraction && 
            typeof window.SubtitleExtraction.preloadSubtitlesWithTimestamps === 'function') {
            window.SubtitleExtraction.preloadSubtitlesWithTimestamps()
                .then((result) => {
                    subtitlesWithTimestamps = result;
                    console.log(
                        "Subtitles with timestamps loaded successfully",
                    );
                })
                .catch((error) => {
                    console.error("Error loading subtitles with timestamps:", error);
                });
        }

        // Función para verificar el tiempo actual y activar subtítulos
        function checkVideoTimeAndProcessSubtitles() {
            try {
                // Verificar contexto al inicio
                if (!isExtensionContextValid()) {
                    handleInvalidContext();
                    return;
                }

                if (!subtitlesWithTimestamps) return;

                const videoElement = document.querySelector("video");
                if (!videoElement || isNaN(videoElement.currentTime)) return;

                const currentTime = Math.floor(videoElement.currentTime);

                // Solo procesar si cambiamos de segundo
                if (currentTime !== lastProcessedTime) {
                    lastProcessedTime = currentTime;

                    // Buscar subtítulos que correspondan al tiempo actual
                    Object.keys(subtitlesWithTimestamps).forEach((startTime) => {
                        try {
                            const startTimeFloat = parseFloat(startTime);
                            if (!isNaN(startTimeFloat) && Math.abs(startTimeFloat - currentTime) < 1.5) {
                                const subtitleText = subtitlesWithTimestamps[startTime];
                                processSubtitleText(subtitleText);
                            }
                        } catch (error) {
                            console.error('Error processing subtitle time:', error);
                        }
                    });
                }
            } catch (error) {
                console.error('Error in checkVideoTimeAndProcessSubtitles:', error);
            }
        }

        // Procesar texto de subtítulos para detectar palabras de la lista
        function processSubtitleText(text) {
            if (!text || typeof text !== 'string') return;

            try {
                console.log("Processing hidden subtitle:", text);

                // Verificar contexto antes de usar Chrome APIs
                if (!isExtensionContextValid()) {
                    handleInvalidContext();
                    return;
                }

                chrome.storage.local.get(["frequencyWordList"], function (result) {
                    try {
                        // Verificar contexto nuevamente en el callback
                        if (!isExtensionContextValid()) {
                            handleInvalidContext();
                            return;
                        }

                        if (
                            result.frequencyWordList &&
                            Array.isArray(result.frequencyWordList) &&
                            result.frequencyWordList.length > 0
                        ) {
                            const frequencyWordList = result.frequencyWordList;

                            // Usar la función centralizada para procesar el texto
                            if (window.TextProcessing && 
                                typeof window.TextProcessing.processSubtitleTextForWordDetection === 'function') {
                                window.TextProcessing.processSubtitleTextForWordDetection(
                                    text,
                                    frequencyWordList,
                                    function (word) {
                                        trackWordAppearance(word);
                                        console.log(
                                            `Word detected from hidden subtitles: "${word}"`,
                                        );
                                    },
                                );
                            }
                        }
                    } catch (error) {
                        console.error('Error processing subtitle text:', error);
                        // Si el error es por contexto invalidado, manejar
                        if (error.message && error.message.includes('Extension context invalidated')) {
                            handleInvalidContext();
                        }
                    }
                });
            } catch (error) {
                console.error('Error in processSubtitleText:', error);
            }
        }

        // Iniciar monitoreo de tiempo de video
        hiddenSubtitleInterval = setInterval(checkVideoTimeAndProcessSubtitles, 250);
        window.noticingGameHiddenSubtitleInterval = hiddenSubtitleInterval;

        return true;
    }

    // Limpiar todos los datos y recursos
    function cleanup() {
        try {
            clearIntervals();
            
            // Limpiar datos de palabras
            Object.keys(recentWords).forEach(key => delete recentWords[key]);
            Object.keys(notedWords).forEach(key => delete notedWords[key]);
            
            console.log("WordDetection: Cleanup completed");
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
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
        clearIntervals,
        cleanup,
    };
})();
