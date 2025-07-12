// Módulo de integración con YouTube para Noticing Game
window.YouTubeIntegration = (function () {
  // Función para crear SVG del interruptor de pausa
  function createPauseToggleSVG(isOn, isVideoPaused = false) {
    let circleColor;

    if (isOn) {
      // Si está activado, mostrar verde cuando reproduce, rojo cuando pausa
      circleColor = isVideoPaused
        ? "rgba(255,67,67,0.35)"
        : "rgba(76,175,80,0.35)";
      return `
                <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="35" cy="24" r="9" fill="${circleColor}"/>
                </svg>
            `;
    } else {
      // OFF: círculo a la izquierda, mismo estilo que el otro interruptor
      return `
                <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
                </svg>
            `;
    }
  }

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

    // Fijar el botón justo en la mitad vertical del reproductor
    Object.assign(toggleBtn.style, {
      position: "absolute",
      top: "50%",
      left: "auto",
      right: "12px",
      transform: "translateY(-50%)",
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

    // Crear interruptor de pausa de tiempo
    const pauseToggle = createPauseToggleButton(player);

    // --- Lógica de auto-ocultamiento y aparición ---
    let hideTimeout = null;
    let lastMouseMove = Date.now();

    function showToggle() {
      toggleBtn.style.opacity = "1";
      toggleBtn.style.pointerEvents = "auto";
      if (pauseToggle) {
        pauseToggle.style.opacity = "1";
        pauseToggle.style.pointerEvents = "auto";
      }
    }

    function hideToggle() {
      // Solo ocultar si el video está reproduciéndose
      const video = player.querySelector("video");
      if (video && !video.paused && !video.ended) {
        toggleBtn.style.opacity = "0";
        toggleBtn.style.pointerEvents = "none";
        if (pauseToggle) {
          pauseToggle.style.opacity = "0";
          pauseToggle.style.pointerEvents = "none";
        }
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

  // Crear interruptor flotante para pausa de tiempo
  function createPauseToggleButton(player) {
    // Si ya existe, no lo agregues de nuevo
    if (document.querySelector(".noticing-game-pause-toggle")) {
      return document.querySelector(".noticing-game-pause-toggle");
    }

    let isPauseTimeEnabled = false;
    let isVideoPaused = false;

    const pauseToggleBtn = document.createElement("button");
    pauseToggleBtn.className = "noticing-game-pause-toggle";
    pauseToggleBtn.setAttribute(
      "title",
      "Toggle pause timers when video stops",
    );

    // Función para actualizar el SVG basado en estado del video
    function updatePauseToggleSVG() {
      pauseToggleBtn.innerHTML = createPauseToggleSVG(
        isPauseTimeEnabled,
        isVideoPaused,
      );
    }

    // Cargar estado inicial desde storage
    chrome.storage.local.get(["pauseTimeWhenVideoStops"], function (result) {
      isPauseTimeEnabled = result.pauseTimeWhenVideoStops || false;
      pauseToggleBtn.dataset.state = isPauseTimeEnabled ? "on" : "off";
      updatePauseToggleSVG();
    });

    // Estilos del botón - Posicionado debajo del interruptor principal
    Object.assign(pauseToggleBtn.style, {
      position: "absolute",
      top: "calc(50% + 52px)", // Debajo del otro interruptor
      left: "auto",
      right: "12px", // Misma posición horizontal que el principal
      transform: "translateY(-50%)",
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
      opacity: "1",
      transition: "opacity 0.3s ease",
    });

    // Monitorear estado del video
    const video = player.querySelector("video");
    if (video) {
      const updateVideoState = () => {
        const newPausedState = video.paused || video.ended;
        if (newPausedState !== isVideoPaused) {
          isVideoPaused = newPausedState;
          if (isPauseTimeEnabled) {
            updatePauseToggleSVG();
          }
        }
      };

      video.addEventListener("pause", updateVideoState);
      video.addEventListener("play", updateVideoState);
      video.addEventListener("ended", updateVideoState);

      // Estado inicial
      isVideoPaused = video.paused || video.ended;
      updatePauseToggleSVG();
    }

    pauseToggleBtn.addEventListener("click", function () {
      isPauseTimeEnabled = !isPauseTimeEnabled;
      this.dataset.state = isPauseTimeEnabled ? "on" : "off";
      updatePauseToggleSVG();

      // Guardar en storage
      chrome.storage.local.set(
        { pauseTimeWhenVideoStops: isPauseTimeEnabled },
        function () {
          // Notificar al módulo WordDetection
          if (
            window.WordDetection &&
            typeof window.WordDetection.setPauseTimeWhenVideoStops ===
              "function"
          ) {
            window.WordDetection.setPauseTimeWhenVideoStops(isPauseTimeEnabled);
          }

          // Actualizar el toggle en configuración si existe
          const configToggle = document.querySelector("#pause-time-toggle");
          if (configToggle) {
            configToggle.checked = isPauseTimeEnabled;
          }

          // Mostrar mensaje de confirmación en la UI si existe
          const statusElem = document.querySelector(".noticing-game-status");
          if (statusElem) {
            const oldText = statusElem.textContent;
            statusElem.textContent = `Pause timers when video stops: ${isPauseTimeEnabled ? "ON" : "OFF"}`;
            statusElem.style.color = "#4caf50";
            setTimeout(() => {
              statusElem.textContent = oldText;
              statusElem.style.color = "";
            }, 3000);
          }

          console.log(
            `Video toggle: Pause time feature ${isPauseTimeEnabled ? "enabled" : "disabled"}`,
          );
        },
      );
    });

    // Asegurar contexto de posicionamiento relativo en el reproductor
    if (player.style.position === "" || player.style.position === "static") {
      player.style.position = "relative";
    }
    player.appendChild(pauseToggleBtn);

    // Configurar auto-ocultamiento inicial
    pauseToggleBtn.style.opacity = "1";

    return pauseToggleBtn;
  }

  // Exponer función para crear SVG de pausa (para uso en UI Manager)
  window.createPauseToggleSVG = createPauseToggleSVG;

  // Función para sincronizar el estado desde configuración
  window.syncPauseToggleFromConfig = function (isEnabled) {
    const pauseToggle = document.querySelector(".noticing-game-pause-toggle");
    if (pauseToggle) {
      // Buscar el estado actual y actualizar
      chrome.storage.local.get(["pauseTimeWhenVideoStops"], function (result) {
        const currentState = result.pauseTimeWhenVideoStops || false;
        pauseToggle.dataset.state = currentState ? "on" : "off";

        // Obtener estado del video
        const video = document.querySelector("video");
        const isVideoPaused = video ? video.paused || video.ended : false;

        pauseToggle.innerHTML = createPauseToggleSVG(
          currentState,
          isVideoPaused,
        );
        console.log(
          `Config sync: Pause toggle updated to ${currentState ? "on" : "off"}`,
        );
      });
    }
  };

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
    createPauseToggleButton,
    waitForYouTubeControls,
  };
})();
