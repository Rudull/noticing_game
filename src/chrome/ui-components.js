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

  // Exportar funciones públicas
  return {
    createButton,
    createContainer,
    createTitle,
    createTextElement,
    showTemporaryMessage,
    showConfirmDialog,
  };
})();
