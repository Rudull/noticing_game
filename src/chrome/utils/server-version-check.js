/**
 * Noticing Game - Utilidad para verificación de versión del servidor backend
 *
 * Este módulo permite consultar la versión del servidor backend y compararla
 * contra la versión mínima requerida por la extensión.
 *
 * Uso:
 *   ServerVersionCheck.checkServerVersion().then(result => { ... });
 */

const ServerVersionCheck = (function () {
    // Cambia esto si la versión mínima cambia en el futuro
    const MIN_SERVER_VERSION = "0.1.1";

    // Compara dos versiones semánticas (ej: "0.1.1" vs "0.1.0")
    function compareVersions(v1, v2) {
        console.log(
            `ServerVersionCheck: Comparing versions: "${v1}" vs "${v2}"`,
        );

        if (!v1 || !v2) {
            console.warn(
                "ServerVersionCheck: Invalid version strings provided",
            );
            return 0;
        }

        const a = v1.split(".").map(Number);
        const b = v2.split(".").map(Number);

        console.log(
            `ServerVersionCheck: Parsed versions: [${a.join(", ")}] vs [${b.join(", ")}]`,
        );

        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const num1 = a[i] || 0;
            const num2 = b[i] || 0;
            console.log(
                `ServerVersionCheck: Comparing part ${i}: ${num1} vs ${num2}`,
            );
            if (num1 > num2) {
                console.log(
                    `ServerVersionCheck: v1 is newer (${num1} > ${num2})`,
                );
                return 1;
            }
            if (num1 < num2) {
                console.log(
                    `ServerVersionCheck: v1 is older (${num1} < ${num2})`,
                );
                return -1;
            }
        }
        console.log("ServerVersionCheck: Versions are equal");
        return 0;
    }

    // Obtiene la URL base del backend desde chrome.storage o usa el valor por defecto
    function getBackendUrl(callback) {
        if (typeof chrome !== "undefined" && chrome.storage) {
            chrome.storage.local.get(["backendServerPort"], function (result) {
                const port = result.backendServerPort || 5000;
                const url = `http://localhost:${port}`;
                console.log(`ServerVersionCheck: Using backend URL: ${url}`);
                callback(url);
            });
        } else {
            const url = "http://localhost:5000";
            console.log(
                `ServerVersionCheck: Using default backend URL: ${url}`,
            );
            callback(url);
        }
    }

    /**
     * Consulta la versión del servidor y la compara con la mínima requerida.
     * @returns {Promise<{ok: boolean, serverVersion: string, minVersion: string, outdated: boolean, error?: string}>}
     */
    function checkServerVersion() {
        console.log("ServerVersionCheck: Starting server version check...");
        return new Promise((resolve) => {
            getBackendUrl((backendUrl) => {
                console.log(
                    `ServerVersionCheck: Checking version at ${backendUrl}/info`,
                );
                fetch(`${backendUrl}/info`)
                    .then((response) => {
                        console.log(
                            `ServerVersionCheck: Received response with status: ${response.status}`,
                        );
                        if (!response.ok)
                            throw new Error(
                                `Server responded with status ${response.status}`,
                            );
                        return response.json();
                    })
                    .then((data) => {
                        console.log(
                            "ServerVersionCheck: Server info data:",
                            data,
                        );
                        const serverVersion = data.version || "0.0.0";
                        console.log(
                            `ServerVersionCheck: Server version: ${serverVersion}, Required: ${MIN_SERVER_VERSION}`,
                        );
                        const cmp = compareVersions(
                            serverVersion,
                            MIN_SERVER_VERSION,
                        );
                        const outdated = cmp < 0;
                        console.log(
                            `ServerVersionCheck: Version comparison result: ${cmp}, Outdated: ${outdated}`,
                        );

                        const result = {
                            ok: true,
                            serverVersion,
                            minVersion: MIN_SERVER_VERSION,
                            outdated,
                        };
                        console.log(
                            "ServerVersionCheck: Final result:",
                            result,
                        );
                        resolve(result);
                    })
                    .catch((err) => {
                        console.error(
                            "ServerVersionCheck: Error checking server version:",
                            err,
                        );
                        const result = {
                            ok: false,
                            serverVersion: null,
                            minVersion: MIN_SERVER_VERSION,
                            outdated: true,
                            error: err.message || "Could not connect to server",
                        };
                        console.log(
                            "ServerVersionCheck: Error result:",
                            result,
                        );
                        resolve(result);
                    });
            });
        });
    }

    // Muestra advertencia en una ventana modal emergente si el servidor está desactualizado
    function showOutdatedWarning(serverVersion, minVersion) {
        console.log(
            `ServerVersionCheck: Showing outdated warning - Server: ${serverVersion}, Required: ${minVersion}`,
        );

        // Evitar múltiples modales
        if (document.getElementById("ng-server-version-modal")) {
            console.log("ServerVersionCheck: Modal already exists, skipping");
            return;
        }

        // Crear fondo semitransparente
        const overlay = document.createElement("div");
        overlay.id = "ng-server-version-modal";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(0,0,0,0.35)";
        overlay.style.zIndex = "11000";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        // Crear contenido del modal
        const modal = document.createElement("div");
        modal.style.background = "var(--ng-modal-bg, #fff)";
        modal.style.padding = "32px 28px 24px 28px";
        modal.style.borderRadius = "12px";
        modal.style.maxWidth = "420px";
        modal.style.width = "90%";
        modal.style.boxShadow = "0 4px 32px rgba(0,0,0,0.18)";
        modal.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        modal.style.position = "relative";
        modal.style.textAlign = "left";
        modal.style.fontSize = "1.15em";
        modal.style.color = "var(--ng-modal-fg, #222)";

        // Icono de advertencia
        const icon = document.createElement("div");
        icon.innerHTML = "&#9888;"; // ⚠️
        icon.style.fontSize = "32px";
        icon.style.color = "#ff9800";
        icon.style.marginBottom = "12px";
        icon.style.textAlign = "center";
        modal.appendChild(icon);

        // Botón de cerrar (X)
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "12px";
        closeBtn.style.right = "16px";
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.fontSize = "22px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "#888";
        closeBtn.onmouseover = () => (closeBtn.style.color = "#000");
        closeBtn.onmouseout = () => (closeBtn.style.color = "#888");
        closeBtn.onclick = () => document.body.removeChild(overlay);
        modal.appendChild(closeBtn);

        // Mensaje principal
        const mainMsg = document.createElement("div");
        mainMsg.style.marginBottom = "8px";
        mainMsg.innerHTML = `<b>Your Noticing Game server version (${serverVersion}) is outdated.</b>`;
        modal.appendChild(mainMsg);

        // Mensaje de advertencia
        const warnMsg = document.createElement("div");
        warnMsg.style.marginBottom = "10px";
        warnMsg.innerHTML = `
        <span>
            You may be able to use the extension, but <b>some features may not work correctly or you may experience errors</b>.<br>
            <b>It is strongly recommended to update to at least version ${minVersion} for full compatibility.</b>
        </span>
    `;
        modal.appendChild(warnMsg);

        // Enlace de descarga
        const linkDiv = document.createElement("div");
        linkDiv.style.marginTop = "10px";
        linkDiv.innerHTML = `
        <a href="https://github.com/Rudull/noticing_game" target="_blank" style="color: #6544e9; text-decoration: underline; font-weight: bold;">
            Download the latest server version
        </a>
    `;
        modal.appendChild(linkDiv);

        // Añadir modal al overlay y al body
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        console.log(
            "ServerVersionCheck: Outdated warning modal displayed successfully",
        );

        // Animación CSS y tema adaptativo
        const style = document.createElement("style");
        style.textContent = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Tema claro por defecto */
:root {
  --ng-modal-bg: #fff;
  --ng-modal-fg: #222;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ng-modal-bg: #23272e;
    --ng-modal-fg: #f1f1f1;
  }
}
`;
        document.head.appendChild(style);
    }

    // Muestra error de conexión en la UI
    function showConnectionError(errorMsg) {
        console.log(
            `ServerVersionCheck: Showing connection error: ${errorMsg}`,
        );
        const statusElements = document.querySelectorAll(
            ".noticing-game-status",
        );
        console.log(
            `ServerVersionCheck: Found ${statusElements.length} status elements to update`,
        );
        statusElements.forEach((element) => {
            element.innerHTML = `
                <div style="color: red; font-weight: bold;">
                    ❌ Could not connect to Noticing Game server.<br>
                    ${errorMsg ? `<span style="font-size:12px;">${errorMsg}</span><br>` : ""}
                    Please make sure the server is running and accessible.
                </div>
            `;
        });
    }

    // Función de debug para verificar estado del módulo
    function debugInfo() {
        console.log("=== ServerVersionCheck Debug Info ===");
        console.log("MIN_SERVER_VERSION:", MIN_SERVER_VERSION);
        console.log(
            "Module loaded:",
            typeof window.ServerVersionCheck !== "undefined",
        );
        console.log("All functions available:", {
            compareVersions: typeof compareVersions === "function",
            checkServerVersion: typeof checkServerVersion === "function",
            showOutdatedWarning: typeof showOutdatedWarning === "function",
            showConnectionError: typeof showConnectionError === "function",
        });
        console.log("=====================================");
    }

    // API pública
    return {
        MIN_SERVER_VERSION,
        compareVersions,
        checkServerVersion,
        showOutdatedWarning,
        showConnectionError,
        debugInfo,
    };
})();

// Exportar para uso global si es necesario
window.ServerVersionCheck = ServerVersionCheck;
