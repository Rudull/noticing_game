// Módulo centralizado para procesamiento de texto en subtítulos
window.TextProcessing = (function () {
    // Función mejorada para extraer palabras limpias de texto con puntuación
    function extractCleanWords(text) {
        if (!text || typeof text !== "string") {
            return [];
        }

        // Paso 1: Preservar contracciones importantes antes de cualquier procesamiento
        const preservedText = text.replace(/I'm/gi, "i'm");

        // Paso 2: Convertir a minúsculas
        let processedText = preservedText.toLowerCase().trim();

        // Paso 3: Reemplazar entidades HTML comunes (especialmente importante para apóstrofes)
        processedText = processedText
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"');

        // Paso 4: Preservar apóstrofes dentro de palabras pero eliminar otra puntuación
        processedText = processedText.replace(
            /([.,?!;"(\)\[\]{}:\/\\-])/g,
            " ",
        );

        // Paso 5: Normalizar espacios múltiples a uno solo
        processedText = processedText.replace(/\s+/g, " ").trim();

        // Paso 6: Tratamiento especial para contracciones comunes
        processedText = processedText
            .replace(/(\s|^)i'm(\s|$)/g, " i'm ")
            .replace(/(\s|^)i(\s|$)/g, " i ");

        // Paso 7: Dividir por espacios, limpiar comillas y filtrar
        // Paso 7: Dividir por espacios, limpiar comillas ASCII y Unicode, y filtrar
        const words = processedText
            .split(" ")
            .map((word) => word.replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, "").trim())
            .filter((word) => {
                // Filtrar palabras vacías
                if (!word || word.length === 0) return false;

                // Filtrar palabras que contengan solo números
                if (/^\d+$/.test(word)) return false;

                // Filtrar palabras muy cortas que podrían ser restos de puntuación
                if (word.length === 1 && !/[a-z]/.test(word)) return false;

                // Aceptar palabras que contengan al menos una letra
                return /[a-z]/.test(word);
            });

        return words;
    }

    // Función para procesar texto de subtítulos y detectar palabras de la lista
    function processSubtitleTextForWordDetection(
        text,
        frequencyWordList,
        trackWordCallback,
    ) {
        const words = extractCleanWords(text);

        words.forEach((word) => {
            if (frequencyWordList.includes(word)) {
                if (typeof trackWordCallback === "function") {
                    trackWordCallback(word);
                }
                console.log(`Word/Contraction detected: "${word}"`);
            }
        });

        return words;
    }

    // Exportar funciones públicas
    return {
        extractCleanWords,
        processSubtitleTextForWordDetection,
    };
})();
