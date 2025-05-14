// Módulo de integración con YouTube para Noticing Game
window.YouTubeIntegration = (function () {
  // Crear botón para mostrar/ocultar panel
  function createToggleButton(callback) {
    const ytControls = document.querySelector(".ytp-right-controls");
    if (!ytControls) return null;

    // Verificar si ya existe
    if (document.querySelector(".noticing-game-toggle")) {
      return document.querySelector(".noticing-game-toggle");
    }

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "ytp-button noticing-game-toggle";
    toggleBtn.setAttribute("title", "Show/Hide Noticing Game");
    toggleBtn.innerHTML = "NG";
    toggleBtn.style.fontSize = "13px";
    toggleBtn.style.fontWeight = "bold";

    toggleBtn.addEventListener("click", callback);

    ytControls.insertBefore(toggleBtn, ytControls.firstChild);
    return toggleBtn;
  }

  // Esperar a que la página de YouTube esté completamente cargada
  function waitForYouTubeControls(callback) {
    if (document.querySelector(".ytp-right-controls")) {
      if (callback) callback();
    } else {
      setTimeout(() => waitForYouTubeControls(callback), 1000);
    }
  }

  // Exportar funciones públicas
  return {
    createToggleButton,
    waitForYouTubeControls,
  };
})();
