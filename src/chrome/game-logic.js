// Módulo de lógica del juego para Noticing Game
window.GameLogic = (function () {
  const UI = window.UIComponents;

  // Importantes constantes del juego
  const CLICKS_TO_REPLACE_WORD = 3;
  const MAX_POINTS = 100; // Puntos máximos por palabra
  const PENALTY_POINTS = 75; // Puntos de penalización

  // Función utilitaria para formatear la palabra (asegurando que "i" se muestre como "I")
  function formatWordDisplay(word) {
    const displayWord = word.toLowerCase() === "i" ? "I" : word;
    return displayWord;
  }

  // Función para crear los puntos de progreso
  function createProgressDots(button, clickCount) {
    // Limpiar puntos anteriores si existen
    const existingDots = button.querySelector(".progress-dots");
    if (existingDots) {
      button.removeChild(existingDots);
    }

    if (clickCount <= 0) return;

    // Crear contenedor de puntos
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "progress-dots";

    // Añadir la cantidad correcta de puntos
    for (let i = 0; i < clickCount && i < CLICKS_TO_REPLACE_WORD; i++) {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      dotsContainer.appendChild(dot);
    }

    button.appendChild(dotsContainer);
  }

  // Función auxiliar para formatear números con separadores de miles usando punto
  function formatNumber(num) {
    // Convertir número a string y formatear manualmente con puntos como separadores de miles
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Contador global de palabras superadas
  let overcomeTotalWords = 0;

  // Conjunto para rastrear palabras que ya han sido superadas
  let completedWords = new Set();

  // Variables para el juego
  let userScore = 0;
  let displayedWords = [];
  let availableWords = [];
  let allWords = [];

  // Inicializar el juego con palabras
  function initializeGame(words) {
    // Reiniciar variables
    userScore = 0;
    completedWords = new Set();

    // Separar palabras mostradas y palabras disponibles para reemplazo
    displayedWords = words.slice(0, 25);
    availableWords = words.slice(25);

    // Crear copia completa de las palabras para reciclaje en caso de listas pequeñas
    allWords = [...words];

    return {
      displayedWords,
      availableWords,
      userScore,
      completedWords,
    };
  }

  // Procesar clic en una palabra
  function processWordClick(wordButton, wordInfo, container, statusElement) {
    const wordText = wordInfo.word.toLowerCase().trim();

    // Importante: Acceder a SubtitleProcessor directamente desde el objeto window
    // para asegurarnos de que tenemos la referencia correcta
    const SP = window.SubtitleProcessor;

    console.log(`Clic en botón de palabra: "${wordText}"`);

    if (!SP) {
      console.error("SubtitleProcessor no está disponible");
      return;
    }

    console.log(
      `Estado actual de recentWords:`,
      JSON.stringify(SP.recentWords),
    );

    // Obtener información detallada sobre la palabra
    const wordStatus = SP.isWordRecent(wordText);

    if (wordStatus.isRecent && !wordStatus.alreadyNoted) {
      // La palabra es reciente y no ha sido notada en esta aparición
      handleCorrectClick(wordButton, wordInfo, wordStatus.timeDiff);
      // Marcar la palabra como notada para esta aparición
      SP.markWordAsNoted(wordText);
    } else if (wordStatus.isRecent && wordStatus.alreadyNoted) {
      // La palabra ya fue notada en esta aparición
      handleAlreadyNotedClick(wordButton, wordInfo, statusElement);
    } else {
      // La palabra no es reciente (expiró o nunca existió)
      handleIncorrectClick(wordButton, wordInfo, statusElement);
    }

    // Si se ha hecho clic el número configurado de veces O se ha hecho clic tantas veces como aparece la palabra (para palabras con baja frecuencia)
    if (
      parseInt(wordButton.dataset.clicks) >= CLICKS_TO_REPLACE_WORD ||
      (wordInfo.count < CLICKS_TO_REPLACE_WORD &&
        parseInt(wordButton.dataset.clicks) >= wordInfo.count)
    ) {
      replaceOrRemoveWordButton(wordButton, wordInfo, container, statusElement);
    }
  }

  // Manejar clic correcto con nueva lógica de puntuación basada en tiempo
  function handleCorrectClick(wordButton, wordInfo, timeDiff) {
    console.log(
      `¡ÉXITO! Palabra "${wordInfo.word}" encontrada como reciente, tiempo: ${timeDiff}ms`,
    );

    // Incrementar contador de clics para esta palabra
    const currentClicks = parseInt(wordButton.dataset.clicks) || 0;
    const newClicks = currentClicks + 1;
    wordButton.dataset.clicks = newClicks;

    // Actualizar el texto del botón para mostrar solo la palabra
    wordButton.textContent = formatWordDisplay(wordInfo.word);

    // Añadir los puntos de progreso
    createProgressDots(wordButton, newClicks);

    // Calcular puntos basados en el tiempo transcurrido
    let pointsEarned = 0;

    // Si es menor a 1000ms (1 segundo), gana 100 puntos
    if (timeDiff <= 1000) {
      pointsEarned = MAX_POINTS;
    } else {
      // Disminución gradual de puntos de 100 a 0 durante los 5 segundos
      // La fórmula asegura que a los 5000ms sean 0 puntos
      pointsEarned = Math.max(
        0,
        Math.floor(MAX_POINTS * (1 - (timeDiff - 1000) / 4000)),
      );
    }

    // Incrementar la puntuación total del usuario
    userScore += pointsEarned;
    const scoreElement = document.getElementById("user-score-value");
    if (scoreElement) {
      scoreElement.textContent = formatNumber(userScore);
    }

    // Aplicar efecto visual de éxito y mostrar puntos ganados
    wordButton.classList.add("word-clicked");

    // Guardar texto original y puntos de progreso
    const originalText = wordButton.textContent;
    const dotsContainer = wordButton.querySelector(".progress-dots");
    const hadDots = dotsContainer !== null;
    if (dotsContainer) {
      wordButton.removeChild(dotsContainer);
    }

    // Mostrar puntos ganados temporalmente
    wordButton.textContent = `+${pointsEarned}`;

    setTimeout(() => {
      wordButton.classList.remove("word-clicked");
      wordButton.textContent = originalText;
      // Restaurar puntos de progreso
      if (hadDots) {
        createProgressDots(wordButton, newClicks);
      }
    }, 300);
  }

  // Función para manejar clics en palabras ya notadas
  function handleAlreadyNotedClick(wordButton, wordInfo, statusElement) {
    console.log(
      `Palabra "${wordInfo.word}" ya ha sido notada en esta aparición`,
    );

    // No penaliza, solo muestra un mensaje
    if (statusElement) {
      const oldStatus = statusElement.textContent;
      statusElement.textContent = `"${wordInfo.word}" already noted for this appearance. Wait for it to appear again.`;
      setTimeout(() => {
        statusElement.textContent = oldStatus;
      }, 2000);
    }

    // Pequeña animación para indicar que no hay efecto
    wordButton.classList.add("word-already-noted");
    setTimeout(() => {
      wordButton.classList.remove("word-already-noted");
    }, 200);
  }

  // Manejar clic incorrecto con la nueva penalización
  function handleIncorrectClick(wordButton, wordInfo, statusElement) {
    console.log(`PENALIZACIÓN - Palabra "${wordInfo.word}" NO es reciente`);

    // Si la palabra tiene algún progreso, se debe reiniciar a cero
    const currentClicks = parseInt(wordButton.dataset.clicks) || 0;
    if (currentClicks > 0) {
      wordButton.dataset.clicks = 0;
      wordButton.textContent = formatWordDisplay(wordInfo.word);
      // Eliminar los puntos de progreso
      createProgressDots(wordButton, 0);
      console.log(
        `Reiniciando progreso de la palabra "${wordInfo.word}" a cero`,
      );
    }

    // Palabra no vista recientemente - penalización mayor
    userScore = Math.max(0, userScore - PENALTY_POINTS); // No permitir puntaje negativo
    const scoreElement = document.getElementById("user-score-value");
    if (scoreElement) {
      scoreElement.textContent = formatNumber(userScore);
    }

    // Aplicar efecto visual de penalización
    wordButton.classList.add("word-penalty");

    // Guardar texto original y puntos de progreso
    const originalText = wordButton.textContent;
    const dotsContainer = wordButton.querySelector(".progress-dots");
    if (dotsContainer) {
      wordButton.removeChild(dotsContainer);
    }

    // Mostrar puntos perdidos temporalmente
    wordButton.textContent = `-${PENALTY_POINTS}`;

    setTimeout(() => {
      wordButton.classList.remove("word-penalty");
      wordButton.textContent = originalText;
      // No restaurar puntos porque se han reiniciado a cero
    }, 300);

    // Mostrar mensaje de penalización
    if (statusElement) {
      const oldStatus = statusElement.textContent;
      statusElement.textContent = `Penalty! "${wordInfo.word}" didn't appear recently. -${PENALTY_POINTS} points!`;
      setTimeout(() => {
        statusElement.textContent = oldStatus;
      }, 3000);
    }
  }

  // Reemplazar o eliminar botón de palabra
  function replaceOrRemoveWordButton(
    wordButton,
    wordInfo,
    container,
    statusElement,
  ) {
    // Incrementar contador de palabras superadas
    overcomeTotalWords++;

    // Añadir la palabra superada al conjunto de palabras completadas
    completedWords.add(wordInfo.word.toLowerCase());

    // Actualizar el texto de palabras superadas
    const overcomeText = document.getElementById("overcome-words-counter");
    if (overcomeText) {
      overcomeText.textContent = overcomeTotalWords;
    }

    const buttonIndex = parseInt(wordButton.dataset.index);
    let newWord = null;

    // Intentar obtener una nueva palabra
    if (availableWords.length > 0) {
      // Hay palabras disponibles, usar la primera
      newWord = availableWords.shift();
    } else if (allWords.length > 0) {
      // No hay palabras disponibles en el buffer, reciclar de la lista completa
      // Excluir las palabras que ya están mostradas y las que ya fueron superadas
      const displayedWordTexts = displayedWords.map((w) => w.word);
      const candidateWords = allWords.filter(
        (w) =>
          !displayedWordTexts.includes(w.word) &&
          !completedWords.has(w.word.toLowerCase()),
      );

      if (candidateWords.length > 0) {
        // Seleccionar una palabra al azar de las candidatas
        const randomIndex = Math.floor(Math.random() * candidateWords.length);
        newWord = candidateWords[randomIndex];
      }
      // Si no hay candidatos disponibles, no asignamos newWord para eliminar el botón
    }

    // Si encontramos una palabra para reemplazar, crear un nuevo botón
    if (newWord) {
      // Crear un nuevo botón con la nueva palabra
      const newButton = createWordButton(
        newWord,
        buttonIndex,
        container,
        statusElement,
      );

      // Reemplazar el botón actual
      wordButton.parentNode.replaceChild(newButton, wordButton);

      // Actualizar las palabras mostradas
      displayedWords[buttonIndex] = newWord;
    } else {
      // No hay más palabras disponibles, eliminar el botón
      wordButton.parentNode.removeChild(wordButton);

      // Eliminar de la matriz displayedWords también (usa splice para mantener los índices correctos)
      displayedWords.splice(buttonIndex, 1);

      // Reorganizar los índices de los botones restantes
      const remainingButtons = container.querySelectorAll(
        ".noticing-game-word-button",
      );
      remainingButtons.forEach((button, idx) => {
        button.dataset.index = idx;
      });

      // Notificar al usuario
      if (statusElement) {
        const oldStatus = statusElement.textContent;
        statusElement.textContent = `Word completed! No more words available to replace it.`;
        setTimeout(() => {
          statusElement.textContent = oldStatus;
        }, 3000);
      }
    }
  }

  // Crear botón de palabra
  function createWordButton(wordInfo, index, container, statusElement) {
    const wordButton = document.createElement("button");
    wordButton.className = "noticing-game-word-button";
    wordButton.textContent = formatWordDisplay(wordInfo.word);
    wordButton.title = `Frecuencia en el video: ${wordInfo.count}`;
    wordButton.dataset.clicks = 0;
    wordButton.dataset.index = index;

    // Agregar evento de clic
    wordButton.addEventListener("click", function () {
      processWordClick(this, wordInfo, container, statusElement);
    });

    return wordButton;
  }

  // Obtener contador de palabras superadas
  function getOvercomeTotalWords() {
    return overcomeTotalWords;
  }

  // Reiniciar contador de palabras superadas
  function resetOvercomeTotalWords() {
    overcomeTotalWords = 0;
    return overcomeTotalWords;
  }

  // Exportar funciones públicas
  return {
    CLICKS_TO_REPLACE_WORD,
    MAX_POINTS,
    PENALTY_POINTS,
    initializeGame,
    processWordClick,
    createWordButton,
    getOvercomeTotalWords,
    resetOvercomeTotalWords,
  };
})();
