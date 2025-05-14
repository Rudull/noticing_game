document.addEventListener("DOMContentLoaded", function () {
    console.log("Popup script loaded");

    // La función principal para mostrar el panel con reintento
    function showPanelWithRetry() {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                const activeTab = tabs[0];

                // Verificar que estamos en YouTube
                if (!activeTab.url.includes("youtube.com/watch")) {
                    alert(
                        "You must be on a YouTube video page to use this extension.",
                    );
                    return;
                }

                console.log("Active tab URL:", activeTab.url);
                console.log("Tab ID:", activeTab.id);

                function tryShowPanel(attempts = 0) {
                    console.log(
                        `Attempting to show panel (attempt ${attempts + 1})`,
                    );

                    chrome.tabs.sendMessage(
                        activeTab.id,
                        { action: "showPanel" },
                        function (response) {
                            if (chrome.runtime.lastError) {
                                console.error(
                                    "Error communicating with the page:",
                                    chrome.runtime.lastError,
                                );

                                if (attempts < 3) {
                                    console.log(
                                        `Retrying (attempt ${attempts + 1})...`,
                                    );
                                    // Esperar más tiempo con cada reintento
                                    setTimeout(
                                        () => tryShowPanel(attempts + 1),
                                        1000 * (attempts + 1),
                                    );
                                } else {
                                    // Después de 3 intentos, recargar la página automáticamente
                                    console.log(
                                        "Maximum retry attempts reached, reloading page",
                                    );
                                    chrome.tabs.reload(
                                        activeTab.id,
                                        {},
                                        function () {
                                            // Esperar a que se recargue la página antes de intentar de nuevo
                                            setTimeout(
                                                () => tryShowPanel(0),
                                                3000,
                                            );
                                        },
                                    );
                                }
                                return;
                            }

                            console.log("Response received:", response);

                            if (response && response.success) {
                                console.log("Success! Closing popup");
                                window.close();
                            } else {
                                console.error(
                                    "Error showing panel:",
                                    response ? response.error : "Unknown error",
                                );
                                if (attempts < 3) {
                                    setTimeout(
                                        () => tryShowPanel(attempts + 1),
                                        1000 * (attempts + 1),
                                    );
                                } else {
                                    alert(
                                        "Could not display the panel. Please try again or reload the page.",
                                    );
                                }
                            }
                        },
                    );
                }

                tryShowPanel();
            },
        );
    }

    // Mostrar el panel automáticamente al abrir el popup
    showPanelWithRetry();

    // Mantener el botón existente como alternativa
    document
        .getElementById("showPanelBtn")
        .addEventListener("click", showPanelWithRetry);
});
