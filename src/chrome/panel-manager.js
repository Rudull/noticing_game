// Módulo de gestión del panel para Noticing Game
window.PanelManager = (function () {
  const UI = window.UIComponents;

  // Hacer elemento arrastrable
  function makeDraggable(element, dragHandle) {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;

    dragHandle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      // Obtener posición del cursor al inicio
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // Llamar a función cuando el cursor se mueva
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      // Calcular nueva posición
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // Establecer nueva posición del elemento
      element.style.top = element.offsetTop - pos2 + "px";
      element.style.left = element.offsetLeft - pos1 + "px";
      element.style.right = "auto"; // Para que no interfiera con el posicionamiento
    }

    function closeDragElement() {
      // Detener movimiento cuando se suelta el mouse
      document.onmouseup = null;
      document.onmousemove = null;

      // Guardar la posición final
      const panelDimensions = {
        width: element.style.width || element.offsetWidth + "px",
        height: element.style.height || element.offsetHeight + "px",
        top: element.style.top,
        left: element.style.left,
      };

      chrome.storage.local.set({ panelDimensions: panelDimensions });
      console.log("Saved panel position after drag:", panelDimensions);
    }
  }

  // Guardar dimensiones del panel
  function savePanelDimensions(panel) {
    const panelDimensions = {
      width: panel.style.width,
      height: panel.style.height,
      top: panel.style.top,
      left: panel.style.left,
    };

    chrome.storage.local.set({ panelDimensions: panelDimensions });
    console.log("Saved panel dimensions:", panelDimensions);
  }

  // Cargar dimensiones guardadas
  function loadPanelDimensions(panel) {
    chrome.storage.local.get(["panelDimensions"], function (result) {
      if (result.panelDimensions) {
        // Aplicar dimensiones guardadas
        panel.style.width = result.panelDimensions.width;
        panel.style.height = result.panelDimensions.height;
        panel.style.top = result.panelDimensions.top;
        panel.style.left = result.panelDimensions.left;
        console.log("Restored panel dimensions:", result.panelDimensions);
      }
    });
  }

  // Añadir elemento de redimensionamiento
  function addResizeHandle(panel) {
    const resizer = document.createElement("div");
    resizer.className = "noticing-game-resizer";
    panel.appendChild(resizer);

    // Configurar evento de redimensionamiento
    panel.addEventListener("resize", function () {
      // Ajustar alturas internas si es necesario
      const header = panel.querySelector(".noticing-game-header");
      const content = panel.querySelector(".noticing-game-content");
      if (header && content) {
        content.style.maxHeight =
          panel.offsetHeight - header.offsetHeight - 30 + "px";
      }

      savePanelDimensions(panel);
    });
  }

  // Exportar funciones públicas
  return {
    makeDraggable,
    savePanelDimensions,
    loadPanelDimensions,
    addResizeHandle,
  };
})();
