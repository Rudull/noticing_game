// Módulo centralizado para procesamiento de texto en subtítulos
window.TextProcessing = (function () {
  
  // Función mejorada para extraer palabras limpias de texto con puntuación
  function extractCleanWords(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Paso 1: Convertir a minúsculas
    let processedText = text.toLowerCase().trim();

    // Paso 2: Reemplazar signos de puntuación con espacios (en lugar de insertarlos alrededor)
    // Esto asegura que "Where se convierta en  Where  en lugar de " Where
    processedText = processedText.replace(/[.,?!;'"\(\)\[\]{}:\/\\-]/g, ' ');

    // Paso 3: Normalizar espacios múltiples a uno solo
    processedText = processedText.replace(/\s+/g, ' ').trim();

    // Paso 4: Dividir por espacios y filtrar
    const words = processedText
      .split(' ')
      .filter(word => {
        // Filtrar palabras vacías
        if (!word || word.length === 0) return false;
        
        // Filtrar palabras que contengan solo números
        if (/^\d+$/.test(word)) return false;
        
        // Filtrar palabras muy cortas que podrían ser restos de puntuación
        if (word.length === 1 && !/[a-z]/.test(word)) return false;
        
        // Aceptar palabras que contengan al menos una letra
        return /[a-z]/.test(word);
      })
      .map(word => word.trim()); // Limpiar espacios adicionales

    return words;
  }

  // Función para procesar texto de subtítulos y detectar palabras de la lista
  function processSubtitleTextForWordDetection(text, frequencyWordList, trackWordCallback) {
    const words = extractCleanWords(text);
    
    words.forEach(word => {
      if (frequencyWordList.includes(word)) {
        if (typeof trackWordCallback === 'function') {
          trackWordCallback(word);
        }
        console.log(`Word detected: "${word}"`);
      }
    });

    return words;
  }

  // Exportar funciones públicas
  return {
    extractCleanWords,
    processSubtitleTextForWordDetection
  };
})();
