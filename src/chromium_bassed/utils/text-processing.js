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

    // Función para contar ocurrencias de palabras O frases en el texto
    function countMatches(text, wordList) {
        if (!text || typeof text !== "string" || !wordList || !Array.isArray(wordList)) {
            return {};
        }

        // Obtener tokens del texto completo
        const textTokens = extractCleanWords(text);
        if (textTokens.length === 0) return {};

        const counts = {};
        const MAX_SEPARATION = 5; // Palabras máximas entre partes de un verbo fresal (turn * * * * on)

        wordList.forEach(target => {
            if (!target || typeof target !== 'string') return;

            // Obtener tokens de la frase objetivo
            const targetTokens = extractCleanWords(target);
            const targetLen = targetTokens.length;
            if (targetLen === 0) return;

            let count = 0;

            // Caso palabra simple
            if (targetLen === 1) {
                const searchWord = targetTokens[0];
                for (let i = 0; i < textTokens.length; i++) {
                    if (textTokens[i] === searchWord) {
                        count++;
                    }
                }
            }
            // Caso frase
            else {
                for (let i = 0; i <= textTokens.length - 1; i++) { // Revisamos hasta el final para la primera palabra
                    // Coincidencia con la primera palabra
                    if (textTokens[i] !== targetTokens[0]) continue;

                    // 1. Intentar coincidencia exacta (consecutiva)
                    let isStrictMatch = true;
                    if (i + targetLen > textTokens.length) {
                        isStrictMatch = false;
                    } else {
                        for (let j = 1; j < targetLen; j++) {
                            if (textTokens[i + j] !== targetTokens[j]) {
                                isStrictMatch = false;
                                break;
                            }
                        }
                    }

                    if (isStrictMatch) {
                        count++;
                        // Saltamos los tokens consumidos para evitar solapamientos incorrectos
                        i += targetLen - 1;
                        continue;
                    }

                    // 2. Intentar coincidencia separable (solo para frases de 2 palabras)
                    // Ej: "turn it on" para target "turn on"
                    if (targetLen === 2) {
                        let isSeparableMatch = false;
                        // Buscar la segunda palabra dentro del rango permitido
                        // Empezamos desde i + 2 porque i+1 hubiera sido strict match (o falló)
                        // Pero si falló strict en i+1, podría ser la palabra incorrecta, así que buscamos hasta MAX_SEPARATION
                        for (let k = 1; k <= MAX_SEPARATION; k++) {
                            if (i + k >= textTokens.length) break;
                            if (textTokens[i + k] === targetTokens[1]) {
                                isSeparableMatch = true;
                                // Podríamos avanzar i hasta k, pero por simplicidad solo contamos y seguimos
                                break;
                            }
                        }

                        if (isSeparableMatch) {
                            count++;
                            // No avanzamos i agresivamente aqui para no complicar el loop, 
                            // aunque podría contar "turn" para otra frase si solapa, es poco común.
                        }
                    }
                }
            }

            if (count > 0) {
                counts[target] = count;
            }
        });

        return counts;
    }

    // Función para procesar texto de subtítulos y detectar palabras de la lista
    function processSubtitleTextForWordDetection(
        text,
        frequencyWordList,
        trackWordCallback,
    ) {
        if (!text || typeof text !== "string") return [];

        // Ahora usamos tokenización real en lugar de búsqueda de strings simples
        // para soportar la lógica de verbos separables
        const textTokens = extractCleanWords(text);
        if (textTokens.length === 0) return [];

        const foundWords = [];
        const MAX_SEPARATION = 5;

        frequencyWordList.forEach(target => {
            if (!target) return;

            // Obtener tokens y verificar
            // Nota: Esto podría ser lento si la lista es enorme, pero para < 2000 palabras es aceptable en JS moderno
            const targetTokens = extractCleanWords(target);
            const targetLen = targetTokens.length;
            if (targetLen === 0) return;

            let found = false;

            // Caso palabra simple
            if (targetLen === 1) {
                if (textTokens.includes(targetTokens[0])) {
                    found = true;
                }
            } else {
                // Caso frase (con soporte separable)
                for (let i = 0; i < textTokens.length; i++) {
                    if (textTokens[i] !== targetTokens[0]) continue;

                    // 1. Strict Check
                    let isStrictMatch = true;
                    if (i + targetLen > textTokens.length) {
                        isStrictMatch = false;
                    } else {
                        for (let j = 1; j < targetLen; j++) {
                            if (textTokens[i + j] !== targetTokens[j]) {
                                isStrictMatch = false;
                                break;
                            }
                        }
                    }
                    if (isStrictMatch) {
                        found = true;
                        break;
                    }

                    // 2. Separable Check (solo 2 palabras)
                    if (targetLen === 2) {
                        for (let k = 1; k <= MAX_SEPARATION; k++) {
                            if (i + k >= textTokens.length) break;
                            if (textTokens[i + k] === targetTokens[1]) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
            }

            if (found) {
                // Usamos la forma original de la lista (target) para consistency
                const cleanTarget = target.toLowerCase().trim();
                if (typeof trackWordCallback === "function") {
                    trackWordCallback(cleanTarget);
                }
                foundWords.push(cleanTarget);
            }
        });

        return foundWords;
    }

    // Exportar funciones públicas
    return {
        extractCleanWords,
        countMatches, // Export new function
        processSubtitleTextForWordDetection,
    };
})();
