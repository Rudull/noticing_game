// Módulo de integración con YouTube para Noticing Game
window.YouTubeIntegration = (function () {
  // Crear botón flotante para mostrar/ocultar panel
  function createToggleButton(callback) {
    // Busca el contenedor principal del reproductor
    const player =
      document.querySelector(".html5-video-player") ||
      document.querySelector("#movie_player");
    if (!player) return null;

    // Si ya existe, no lo agregues de nuevo
    if (document.querySelector(".noticing-game-floating-toggle")) {
      return document.querySelector(".noticing-game-floating-toggle");
    }

    // Interruptor SVG minimalista alineado y con cambio visual de estado (on/off)
    let isSwitchOn = false;
    function getSwitchSVG(on) {
      // Óvalo más grueso: altura igual al diámetro del círculo (18), centrado verticalmente (y=15)
      if (on) {
        // ON: círculo a la derecha, óvalo grueso, círculo violeta dentro
        // Ajuste: el óvalo cubre exactamente ambos extremos del círculo
        return `
                  <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="35" cy="24" r="9" fill="rgba(101,68,233,0.35)"/>
                  </svg>
                `;
      } else {
        // OFF: círculo a la izquierda, óvalo grueso, círculo blanco dentro
        return `
                  <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
                  </svg>
                `;
      }
    }

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "noticing-game-floating-toggle";
    toggleBtn.setAttribute("title", "Show/Hide Noticing Game");
    toggleBtn.innerHTML = getSwitchSVG(isSwitchOn);

    // --- Evitar superposición con otros iconos flotantes ---
    let baseBottom = 16;
    let extraOffset = 0;
    const possibleFloaters = Array.from(
      player.querySelectorAll("button,div"),
    ).filter((el) => {
      if (el === toggleBtn) return false;
      const style = window.getComputedStyle(el);
      // Busca elementos absolutamente posicionados en la esquina inferior derecha, suficientemente grandes
      return (
        style.position === "absolute" &&
        parseInt(style.right) <= 32 &&
        parseInt(style.bottom) <= 80 &&
        el.offsetWidth > 24 &&
        el.offsetHeight > 24
      );
    });

    if (possibleFloaters.length > 0) {
      // Suma 48px por cada icono encontrado
      extraOffset = possibleFloaters.length * 48;
    }

    // Ajuste para alineación vertical: usa 48x48px como otros iconos, y bottom=16px (o ajusta según integración visual)
    Object.assign(toggleBtn.style, {
      position: "absolute",
      bottom: baseBottom + extraOffset + "px",
      right: "12px",
      top: "auto",
      zIndex: "10010",
      background: "none",
      border: "none",
      borderRadius: "0",
      padding: "0",
      width: "48px",
      height: "48px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    toggleBtn.onmouseenter = null;
    toggleBtn.onmouseleave = null;

    toggleBtn.addEventListener("click", function () {
      // Centralizado: abrir/cerrar panel y sincronizar estado visual
      if (
        window.NoticingGamePanel &&
        typeof window.NoticingGamePanel.isOpen === "function"
      ) {
        if (window.NoticingGamePanel.isOpen()) {
          window.NoticingGamePanel.close();
        } else {
          window.NoticingGamePanel.open();
        }
      } else {
        // Fallback: alternar visualmente solo
        isSwitchOn = !isSwitchOn;
        toggleBtn.innerHTML = getSwitchSVG(isSwitchOn);
        if (typeof callback === "function") callback();
      }
    });

    // Asegura contexto de posicionamiento relativo en el reproductor
    if (player.style.position === "" || player.style.position === "static") {
      player.style.position = "relative";
    }
    player.appendChild(toggleBtn);

    // --- Lógica de auto-ocultamiento y aparición ---
    let hideTimeout = null;
    let lastMouseMove = Date.now();

    function showToggle() {
      toggleBtn.style.opacity = "1";
      toggleBtn.style.pointerEvents = "auto";
    }

    function hideToggle() {
      // Solo ocultar si el video está reproduciéndose
      const video = player.querySelector("video");
      if (video && !video.paused && !video.ended) {
        toggleBtn.style.opacity = "0";
        toggleBtn.style.pointerEvents = "none";
      }
    }

    function scheduleHide() {
      clearTimeout(hideTimeout);
      const video = player.querySelector("video");
      if (video && !video.paused && !video.ended) {
        hideTimeout = setTimeout(hideToggle, 2500);
      }
    }

    // Mostrar al mover el mouse sobre el reproductor
    player.addEventListener("mousemove", () => {
      showToggle();
      lastMouseMove = Date.now();
      scheduleHide();
    });

    // Mostrar siempre si el video está en pausa
    function onPlayPause() {
      const video = player.querySelector("video");
      if (!video) return;
      if (video.paused || video.ended) {
        showToggle();
        clearTimeout(hideTimeout);
      } else {
        scheduleHide();
      }
    }

    // Escuchar eventos de play/pause
    const video = player.querySelector("video");
    if (video) {
      video.addEventListener("pause", onPlayPause);
      video.addEventListener("play", onPlayPause);
      video.addEventListener("ended", onPlayPause);
    }

    // Inicial: mostrar y programar ocultar si corresponde
    showToggle();
    scheduleHide();

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
