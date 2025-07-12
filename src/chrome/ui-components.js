// Módulo de componentes UI para Noticing Game
window.UIComponents = (function () {
  // Crear un botón genérico
  function createButton(className, text, onClickHandler, additionalProps = {}) {
    const button = document.createElement("button");
    button.className = className;
    button.textContent = text;

    if (onClickHandler) {
      button.addEventListener("click", onClickHandler);
    }

    // Añadir propiedades adicionales
    Object.keys(additionalProps).forEach((prop) => {
      if (prop === "innerHTML") {
        button.innerHTML = additionalProps[prop];
      } else {
        button[prop] = additionalProps[prop];
      }
    });

    return button;
  }

  // Crear un elemento de contenedor
  function createContainer(className, children = []) {
    const container = document.createElement("div");
    container.className = className;

    children.forEach((child) => {
      container.appendChild(child);
    });

    return container;
  }

  // Crear un título
  function createTitle(text, level = 2, className = "") {
    const tag = `h${level}`;
    const title = document.createElement(tag);
    if (className) title.className = className;
    title.textContent = text;
    return title;
  }

  // Crear un elemento de texto
  function createTextElement(tag, text, className = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  // Mostrar un mensaje de estado temporal
  function showTemporaryMessage(
    container,
    message,
    duration = 3000,
    className = "",
  ) {
    const originalContent = container.textContent;
    container.textContent = message;
    if (className) container.classList.add(className);

    setTimeout(() => {
      container.textContent = originalContent;
      if (className) container.classList.remove(className);
    }, duration);
  }

  // Mostrar un diálogo de confirmación
  function showConfirmDialog(message, onConfirm, onCancel) {
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";

    const messageElement = document.createElement("p");
    messageElement.textContent = message;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "confirm-dialog-buttons";

    const confirmButton = createButton("", "Delete", () => {
      onConfirm();
      document.body.removeChild(dialog);
    });
    confirmButton.id = "confirm-delete";

    const cancelButton = createButton("", "Cancel", () => {
      if (onCancel) onCancel();
      document.body.removeChild(dialog);
    });
    cancelButton.id = "cancel-delete";

    buttonContainer.appendChild(confirmButton);
    buttonContainer.appendChild(cancelButton);

    dialog.appendChild(messageElement);
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);

    return dialog;
  }

  // Crear modal de palabras notadas (Noted Words)
  function createLearnedWordsModal(learnedWords, onClose) {
    // Eliminar cualquier modal anterior antes de crear uno nuevo
    const existingModal = document.querySelector(".learned-words-modal");
    if (existingModal && existingModal.parentNode) {
      existingModal.parentNode.removeChild(existingModal);
    }

    // --- Estado para alternar entre notadas y no notadas ---
    let currentView = "noted"; // "noted" o "unnoted"
    let currentWords = learnedWords;
    let unnotedWords = [];
    let statsData = null;

    function getDifficultyClass(score) {
      if (typeof score !== "number" || isNaN(score))
        return "difficulty-unknown";
      if (score <= 2) return "difficulty-easy";
      if (score <= 5) return "difficulty-medium";
      return "difficulty-hard";
    }
    function getDifficultyLabel(score) {
      if (typeof score !== "number" || isNaN(score)) return "Unknown";
      if (score <= 2) return "Easy";
      if (score <= 5) return "Medium";
      return "Hard";
    }

    // Exportar a CSV (incluyendo todas las palabras)
    function exportToCSV() {
      // Obtener todas las palabras (notadas y no notadas)
      if (
        !window.WordDifficultyTracker ||
        typeof window.WordDifficultyTracker.getAllWords !== "function"
      ) {
        console.error("WordDifficultyTracker not available for export");
        return;
      }

      const allWords = window.WordDifficultyTracker.getAllWords();
      if (!allWords || allWords.length === 0) {
        importStatus.textContent = "No word data to export.";
        return;
      }

      // Ordenar de menor a mayor dificultad
      const sorted = [...allWords].sort((a, b) => {
        const da =
          typeof a.difficultyScore === "number" ? a.difficultyScore : 9999;
        const db =
          typeof b.difficultyScore === "number" ? b.difficultyScore : 9999;
        return da - db;
      });

      // Encabezados (agregamos columna de estado)
      const headers = [
        "Word",
        "Status",
        "DifficultyScore",
        "DifficultyLevel",
        "CorrectClicks",
        "IncorrectClicks",
        "PenaltyClicks",
        "AlreadyNotedClicks",
        "TotalClicks",
        "AverageResponseTime(ms)",
        "FirstSeen",
        "LastSeen",
      ];

      // Función para determinar estado de la palabra
      function getWordStatus(stats) {
        if (!stats || stats.totalClicks === 0) return "Unseen";
        if (stats.correctClicks > 0) return "Noted";
        return "Unnoticed";
      }

      // Utilidad para obtener etiqueta de dificultad
      function getDifficultyLabel(score) {
        if (typeof score !== "number" || isNaN(score)) return "Unknown";
        if (score <= 2) return "Easy";
        if (score <= 5) return "Medium";
        return "Hard";
      }

      // Filas
      const rows = sorted.map((item) => {
        const stats = item.stats || {};
        // Solo la fecha YYYY-MM-DD
        function formatDate(ts) {
          if (!ts) return "";
          const d = new Date(ts);
          return (
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0")
          );
        }
        // Mostrar 'I' y 'I'm' en mayúscula en exportación
        let exportWord = item.word;
        if (exportWord === "i") exportWord = "I";
        if (exportWord === "i'm") exportWord = "I'm";
        return [
          `"${exportWord.replace(/"/g, '""')}"`,
          getWordStatus(stats),
          item.difficultyScore != null ? item.difficultyScore : "",
          getDifficultyLabel(item.difficultyScore),
          stats.correctClicks != null ? stats.correctClicks : "",
          stats.incorrectClicks != null ? stats.incorrectClicks : "",
          stats.penaltyClicks != null ? stats.penaltyClicks : "",
          stats.alreadyNotedClicks != null ? stats.alreadyNotedClicks : "",
          stats.totalClicks != null ? stats.totalClicks : "",
          stats.averageResponseTime != null ? stats.averageResponseTime : "",
          formatDate(stats.firstSeen),
          formatDate(stats.lastSeen),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\r\n");

      // Descargar
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "noticing_game_words.csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }

    const modal = document.createElement("div");
    modal.className = "learned-words-modal";

    // --- Contenedor de estadísticas ---
    const statsContainer = document.createElement("div");
    statsContainer.className = "learned-words-stats";
    statsContainer.style.marginBottom = "10px";
    statsContainer.style.fontSize = "13px";
    statsContainer.style.color = "var(--secondary-text)";

    // Header (primer nivel): título a la izquierda, cerrar a la derecha
    const header = document.createElement("div");
    header.className = "learned-words-modal-header";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const title = document.createElement("span");
    title.className = "learned-words-modal-title";
    title.textContent = "Noted Words";

    // Sub-header (segundo nivel): botones a la izquierda, mensaje a la derecha
    const subHeader = document.createElement("div");
    subHeader.className = "learned-words-modal-subheader";
    subHeader.style.display = "flex";
    subHeader.style.justifyContent = "space-between";
    subHeader.style.alignItems = "center";
    subHeader.style.marginTop = "8px";
    subHeader.style.marginBottom = "8px";
    subHeader.style.gap = "8px";

    // Contenedor de botones (izquierda)
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.alignItems = "center";
    btnGroup.style.gap = "8px";

    // Botón Exportar
    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export";
    exportBtn.style.background = "var(--primary-color)";
    exportBtn.style.color = "white";
    exportBtn.style.border = "none";
    exportBtn.style.borderRadius = "4px";
    exportBtn.style.padding = "4px 12px";
    exportBtn.style.fontSize = "13px";
    exportBtn.style.cursor = "pointer";
    exportBtn.style.fontWeight = "bold";
    exportBtn.onclick = () => exportToCSV();

    // Botón Importar
    const importBtn = document.createElement("button");
    importBtn.textContent = "Import";
    importBtn.style.background = "var(--primary-color)";
    importBtn.style.color = "white";
    importBtn.style.border = "none";
    importBtn.style.borderRadius = "4px";
    importBtn.style.padding = "4px 12px";
    importBtn.style.fontSize = "13px";
    importBtn.style.cursor = "pointer";
    importBtn.style.fontWeight = "bold";

    // Input file oculto
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".csv";
    importInput.style.display = "none";

    // Botón Reset
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.style.background = "var(--primary-color)";
    resetBtn.style.color = "white";
    resetBtn.style.border = "none";
    resetBtn.style.borderRadius = "4px";
    resetBtn.style.padding = "4px 12px";
    resetBtn.style.fontSize = "13px";
    resetBtn.style.cursor = "pointer";
    resetBtn.style.fontWeight = "bold";

    // --- Botón para alternar entre notadas y no notadas ---
    const toggleBtn = document.createElement("button");
    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" class="toggle-icon">
      <path d="M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z" fill="white"/>
    </svg>`;
    toggleBtn.title = "Toggle between noted and unnoticed words";
    toggleBtn.style.background = "var(--primary-color)";
    toggleBtn.style.color = "white";
    toggleBtn.style.border = "none";
    toggleBtn.style.borderRadius = "4px";
    toggleBtn.style.padding = "4px 12px";
    toggleBtn.style.fontSize = "13px";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.fontWeight = "bold";
    toggleBtn.style.display = "flex";
    toggleBtn.style.alignItems = "center";
    toggleBtn.style.justifyContent = "center";
    toggleBtn.style.minWidth = "29px";

    // Mensaje de estado de importación (derecha)
    const importStatus = document.createElement("div");
    importStatus.style.fontSize = "12px";
    importStatus.style.color = "var(--secondary-text)";
    importStatus.style.whiteSpace = "nowrap";
    importStatus.style.overflow = "hidden";
    importStatus.style.textOverflow = "ellipsis";
    importStatus.style.marginLeft = "16px";
    importStatus.style.flex = "1";

    importBtn.onclick = () => importInput.click();

    // Reset con confirmación
    resetBtn.onclick = () => {
      if (
        window.UIComponents &&
        typeof window.UIComponents.showConfirmDialog === "function"
      ) {
        window.UIComponents.showConfirmDialog(
          "Are you sure you want to reset your noted words? This cannot be undone.",
          function () {
            if (
              window.WordDifficultyTracker &&
              typeof window.WordDifficultyTracker.resetAllStats === "function"
            ) {
              window.WordDifficultyTracker.resetAllStats();
              setTimeout(() => {
                if (
                  typeof window.WordDifficultyTracker.getLearnedWords ===
                  "function"
                ) {
                  renderList(window.WordDifficultyTracker.getLearnedWords());
                }
                importStatus.textContent = "List reset successfully.";
              }, 150); // Espera breve para asegurar que el reset se refleje
            }
          },
          function () {
            // Cancelar: no hacer nada
          },
        );
      }
    };

    importInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        try {
          const text = evt.target.result;
          // Parsear CSV
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            importStatus.textContent = "Invalid CSV file.";
            return;
          }
          const headers = lines[0].split(",");
          // Mapear columnas
          const idx = {};
          headers.forEach((h, i) => {
            idx[h.replace(/"/g, "").trim()] = i;
          });
          // Construir wordStats
          const wordStats = {};
          for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // CSV seguro con comas en comillas
            if (row.length < 2) continue;
            let word = row[idx["Word"]];
            if (!word) continue;
            word = word.replace(/^"|"$/g, "").replace(/""/g, '"').toLowerCase();
            // Normalizar 'I' y "I'm"
            if (word === "i") word = "i";
            if (word === "i'm") word = "i'm";

            // Leer el estado de la palabra
            const status = row[idx["Status"]]
              ? row[idx["Status"]].replace(/"/g, "")
              : "";

            // Parsear campos numéricos
            function parseNum(val) {
              if (!val) return 0;
              const n = Number(val.replace(/"/g, ""));
              return isNaN(n) ? 0 : n;
            }
            // Parsear fechas
            function parseDate(val) {
              if (!val) return null;
              // YYYY-MM-DD
              const d = new Date(val.replace(/"/g, ""));
              return isNaN(d.getTime()) ? null : d.getTime();
            }
            wordStats[word] = {
              difficultyScore: parseNum(row[idx["DifficultyScore"]]),
              correctClicks: parseNum(row[idx["CorrectClicks"]]),
              incorrectClicks: parseNum(row[idx["IncorrectClicks"]]),
              penaltyClicks: parseNum(row[idx["PenaltyClicks"]]),
              alreadyNotedClicks: parseNum(row[idx["AlreadyNotedClicks"]]),
              totalClicks: parseNum(row[idx["TotalClicks"]]),
              averageResponseTime: parseNum(
                row[idx["AverageResponseTime(ms)"]],
              ),
              totalResponseTime: 0, // No se exporta, se recalcula
              firstSeen: parseDate(row[idx["FirstSeen"]]),
              lastSeen: parseDate(row[idx["LastSeen"]]),
              status: status, // Guardar el estado
            };
            // Calcular totalResponseTime si hay correctClicks y averageResponseTime
            if (
              wordStats[word].correctClicks > 0 &&
              wordStats[word].averageResponseTime > 0
            ) {
              wordStats[word].totalResponseTime =
                wordStats[word].averageResponseTime *
                wordStats[word].correctClicks;
            }
          }
          // Importar usando la API del tracker
          if (
            window.WordDifficultyTracker &&
            typeof window.WordDifficultyTracker.importStats === "function"
          ) {
            const result = window.WordDifficultyTracker.importStats({
              wordStats,
              importDate: new Date().toISOString(),
              version: "1.0",
            });
            if (result) {
              importStatus.textContent =
                "Imported successfully! (" +
                Object.keys(wordStats).length +
                " words)";
              // Actualizar la lista en vivo
              if (
                typeof window.WordDifficultyTracker.getLearnedWords ===
                "function"
              ) {
                const updated = window.WordDifficultyTracker.getLearnedWords();
                renderList(updated);
              }
            } else {
              importStatus.textContent = "Import failed.";
            }
          } else {
            importStatus.textContent = "Import function not available.";
          }
        } catch (err) {
          importStatus.textContent = "Error importing: " + err.message;
        }
      };
      reader.readAsText(file);
    };

    const closeBtn = document.createElement("button");
    closeBtn.className = "learned-words-modal-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      if (typeof onClose === "function") onClose();
    });

    // Header: título a la izquierda, cerrar a la derecha
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Sub-header: botones a la izquierda, mensaje a la derecha
    btnGroup.appendChild(toggleBtn);
    btnGroup.appendChild(exportBtn);
    btnGroup.appendChild(importBtn);
    btnGroup.appendChild(resetBtn);
    btnGroup.appendChild(importInput); // input file oculto, pero funcional

    subHeader.appendChild(btnGroup);
    subHeader.appendChild(importStatus);

    modal.appendChild(header);
    modal.appendChild(subHeader);

    // --- Añadir el contenedor de estadísticas arriba de la lista ---
    modal.appendChild(statsContainer);

    // --- Título dinámico para la lista ---
    const listTitle = document.createElement("div");
    listTitle.className = "learned-words-list-title";
    listTitle.style.fontWeight = "bold";
    listTitle.style.fontSize = "14px";
    listTitle.style.color = "var(--primary-color)";
    listTitle.style.marginBottom = "8px";
    listTitle.style.paddingBottom = "4px";
    listTitle.style.borderBottom = "1px solid var(--border-color)";
    listTitle.textContent = "Noted Words";
    modal.appendChild(listTitle);

    // Contenedor para la lista
    const listContainer = document.createElement("div");
    modal.appendChild(listContainer);

    // Función para renderizar la lista de palabras (notadas o no notadas)
    function renderList(words) {
      listContainer.innerHTML = "";
      if (!words || words.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "learned-words-empty";
        emptyMsg.textContent =
          currentView === "noted"
            ? "No noted words yet."
            : "No unnoticed words found.";
        listContainer.appendChild(emptyMsg);
      } else {
        const list = document.createElement("ul");
        list.className = "learned-words-list";
        // Ordenar de menor a mayor dificultad (si aplica)
        [...words]
          .sort((a, b) => {
            const da =
              typeof a.difficultyScore === "number" ? a.difficultyScore : 9999;
            const db =
              typeof b.difficultyScore === "number" ? b.difficultyScore : 9999;
            return da - db;
          })
          .forEach((item) => {
            const li = document.createElement("li");
            li.className = "learned-word-item";

            const label = document.createElement("span");
            label.className = "learned-word-label";
            // Mostrar 'I' y 'I’m' en mayúscula
            let displayWord = item.word;
            if (displayWord === "i") displayWord = "I";
            if (displayWord === "i'm") displayWord = "I'm";
            label.textContent = displayWord;

            li.appendChild(label);

            // Solo mostrar dificultad si es una palabra notada
            if (currentView === "noted") {
              const diff = document.createElement("span");
              diff.className =
                "learned-word-difficulty " +
                getDifficultyClass(item.difficultyScore);
              diff.textContent = getDifficultyLabel(item.difficultyScore);
              li.appendChild(diff);
            }

            list.appendChild(li);
          });
        listContainer.appendChild(list);
      }
    }

    // --- Función para renderizar estadísticas ---
    function renderStats(stats) {
      if (!stats) {
        statsContainer.innerHTML = "";
        return;
      }

      let html = "";
      // Primera fila
      html += `<div style="margin-bottom: 4px;">`;
      if (currentView === "noted") {
        html += `<b>Total noted words:</b> ${stats.totalNoted} &nbsp;&nbsp; `;
      } else {
        html += `<b>Total unnoticed words:</b> ${stats.totalUnnoted} &nbsp;&nbsp; `;
      }
      html += `<b>Total shown words:</b> ${stats.totalShown}`;
      html += `</div>`;

      // Segunda fila
      html += `<div>`;
      html += `<b>Words noted:</b> ${stats.totalNoted} &nbsp;&nbsp; `;
      html += `<b>Success rate:</b> ${stats.totalShown > 0 ? ((stats.totalNoted / stats.totalShown) * 100).toFixed(1) : "0"}%`;
      html += `</div>`;
      statsContainer.innerHTML = html;
    }

    // --- Obtener palabras no notadas y estadísticas ---
    function refreshModalData() {
      if (
        window.WordDifficultyTracker &&
        typeof window.WordDifficultyTracker.getModalStats === "function" &&
        typeof window.WordDifficultyTracker.getLearnedWords === "function" &&
        typeof window.WordDifficultyTracker.getUnnotedWords === "function"
      ) {
        statsData = window.WordDifficultyTracker.getModalStats();
        currentWords = window.WordDifficultyTracker.getLearnedWords();
        unnotedWords = window.WordDifficultyTracker.getUnnotedWords();
        renderList(currentView === "noted" ? currentWords : unnotedWords);
      }
    }

    // --- Alternar vista al hacer clic en el botón ---
    toggleBtn.onclick = function () {
      if (currentView === "noted") {
        currentView = "unnoted";
        listTitle.textContent = "Unnoticed Words";
      } else {
        currentView = "noted";
        listTitle.textContent = "Noted Words";
      }
      refreshModalData();
      renderStats(statsData);
    };

    // --- Render inicial ---
    refreshModalData();
    renderStats(statsData);

    document.body.appendChild(modal);
    return modal;
  }

  // Exportar funciones públicas
  return {
    createButton,
    createContainer,
    createTitle,
    createTextElement,
    showTemporaryMessage,
    showConfirmDialog,
    createLearnedWordsModal,
  };
})();
