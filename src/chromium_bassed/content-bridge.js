// content-bridge.js
// Este script actúa como puente para manejar comunicaciones entre diferentes contextos

// Sobrescribir el método postMessage para asegurar que se use el origen correcto
(function () {
  // Guardar una referencia al postMessage original
  const originalPostMessage = window.postMessage;

  // Reemplazar el método con nuestra versión segura
  window.postMessage = function (message, targetOrigin, transfer) {
    // Si el targetOrigin es una URL de extensión, cambiarlo a cualquier origen (*) o a YouTube
    if (targetOrigin && targetOrigin.startsWith("chrome-extension://")) {
      console.log(
        "Noticing Game: Correcting postMessage target origin from extension to page",
      );
      // Usar el origen correcto para YouTube o cualquier origen
      targetOrigin = window.location.origin || "*";
    }

    // Llamar al método original con los parámetros corregidos
    return originalPostMessage.call(this, message, targetOrigin, transfer);
  };

  console.log("Noticing Game: Safe message bridge initialized");

  // Añadir un oyente para manejar mensajes desde el contexto de la extensión
  window.addEventListener("message", function (event) {
    // Solo procesar mensajes relacionados con nuestra extensión
    if (event.data && event.data.source === "noticing-game-extension") {
      console.log("Noticing Game: Message received by bridge", event.data);

      // Aquí podríamos añadir lógica adicional para procesar mensajes
      // específicos de nuestra extensión si fuera necesario
    }
  });
})();
