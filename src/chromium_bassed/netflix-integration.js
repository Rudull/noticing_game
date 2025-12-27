// Módulo de integración con Netflix para Noticing Game (Floating UI like YouTube)
window.NetflixIntegration = (function () {

    const SELECTORS = {
        PLAYER_CONTAINER: 'div[data-uia="video-player"]',
        CONTROLS: '.nfp-chrome-controls',
        SUBTITLE_TEXT: '.player-timedtext-text-container span',
    };

    function getSwitchSVG(on) {
        if (on) {
            return `
              <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                <circle cx="35" cy="24" r="9" fill="rgba(101,68,233,0.35)"/>
              </svg>
            `;
        } else {
            return `
              <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
              </svg>
            `;
        }
    }

    function createPauseToggleSVG(isOn, isVideoPaused = false) {
        let circleColor;
        if (isOn) {
            circleColor = isVideoPaused ? "rgba(255,67,67,0.35)" : "rgba(76,175,80,0.35)";
            return `
                <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="35" cy="24" r="9" fill="${circleColor}"/>
                </svg>
            `;
        } else {
            return `
                <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
                </svg>
            `;
        }
    }

    function getPlayerContainer() {
        // Try to find the specific Netflix player container
        const specificContainer = document.querySelector(SELECTORS.PLAYER_CONTAINER);
        if (specificContainer) return specificContainer;

        // Fallback: Use video tag to find container
        const video = document.querySelector('video');
        if (video) {
            // Try to find the UI layer wrapper (nfp-driver-layer-window)
            // or the player wrapper
            let el = video.parentNode;
            while (el && el !== document.body) {
                if (el.classList.contains('nfp-driver-layer-window') ||
                    el.getAttribute('data-uia') === 'video-player' ||
                    el.classList.contains('netflix-sans-font-loaded')) {
                    return el;
                }
                el = el.parentNode;
            }
            return video.parentNode;
        }

        return document.body;
    }

    // ... createToggleButton ... (Requires no change if it calls getPlayerContainer) ...

    // We need to verify wait logic too
    function waitForNetflixControls(callback) {
        const check = setInterval(() => {
            // Check for any sign of the player
            if (document.querySelector('video') || document.querySelector(SELECTORS.PLAYER_CONTAINER)) {
                clearInterval(check);
                callback();
            }
        }, 1000);
    }

    function createToggleButton(callback) {
        if (document.querySelector("#noticing-game-netflix-toggle")) {
            return document.querySelector("#noticing-game-netflix-toggle");
        }

        const container = getPlayerContainer();
        let isSwitchOn = false;

        if (window.NoticingGamePanel && typeof window.NoticingGamePanel.isOpen === "function") {
            isSwitchOn = window.NoticingGamePanel.isOpen();
        }

        const btn = document.createElement("button");
        btn.id = "noticing-game-netflix-toggle";
        btn.className = "noticing-game-floating-toggle";

        Object.assign(btn.style, {
            position: "absolute",
            top: "50%",
            right: "12px",
            transform: "translateY(-50%)",
            zIndex: "10010",
            background: "none",
            border: "none",
            padding: "0",
            width: "48px",
            height: "48px",
            cursor: "pointer",
            display: "block"
        });

        btn.title = "Show/Hide Noticing Game";
        btn.innerHTML = getSwitchSVG(isSwitchOn);

        btn.addEventListener("click", () => {
            isSwitchOn = !isSwitchOn;
            if (window.NoticingGamePanel) {
                if (window.NoticingGamePanel.isOpen()) {
                    window.NoticingGamePanel.close();
                    isSwitchOn = false;
                } else {
                    window.NoticingGamePanel.open();
                    isSwitchOn = true;
                }
            } else {
                if (callback) callback();
            }
            btn.innerHTML = getSwitchSVG(isSwitchOn);
        });

        container.appendChild(btn);
        return btn;
    }

    function createPauseToggle() {
        if (document.querySelector("#noticing-game-netflix-pause")) {
            return document.querySelector("#noticing-game-netflix-pause");
        }

        const container = getPlayerContainer();

        // Logic for state
        let isPauseTimeEnabled = false;
        let isVideoPaused = false;

        const btn = document.createElement("button");
        btn.id = "noticing-game-netflix-pause";
        btn.className = "noticing-game-pause-toggle";

        // Position below the main toggle
        Object.assign(btn.style, {
            position: "absolute",
            top: "calc(50% + 52px)",
            right: "12px",
            transform: "translateY(-50%)",
            zIndex: "10010",
            background: "none",
            border: "none",
            padding: "0",
            width: "48px",
            height: "48px",
            cursor: "pointer",
            display: "block"
        });

        btn.title = "Enable/Disable Time Pause on Stop";

        function updateSVG() {
            btn.innerHTML = createPauseToggleSVG(isPauseTimeEnabled, isVideoPaused);
        }

        // Init State
        chrome.storage.local.get(["pauseTimeWhenVideoStops"], function (result) {
            isPauseTimeEnabled = result.pauseTimeWhenVideoStops || false;
            updateSVG();
        });

        // Listen for external changes (Panel -> Button)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.pauseTimeWhenVideoStops) {
                isPauseTimeEnabled = changes.pauseTimeWhenVideoStops.newValue;
                updateSVG();
            }
        });

        btn.addEventListener("click", () => {
            isPauseTimeEnabled = !isPauseTimeEnabled;
            if (window.WordDetection && typeof window.WordDetection.setPauseTimeWhenVideoStops === "function") {
                window.WordDetection.setPauseTimeWhenVideoStops(isPauseTimeEnabled);
            }
            updateSVG();
            if (typeof window.showStatusMessage === 'function') {
                window.showStatusMessage(`Pause timers when video stops: ${isPauseTimeEnabled ? "ON" : "OFF"}`);
            }
        });

        // Monitor Video State
        const video = document.querySelector('video');
        if (video) {
            const checkState = () => {
                const newPaused = video.paused || video.ended;
                if (newPaused !== isVideoPaused) {
                    isVideoPaused = newPaused;
                    // Only update SVG if enabled (color change)
                    if (isPauseTimeEnabled) updateSVG();
                }
            };
            setInterval(checkState, 500);
            video.addEventListener('pause', checkState);
            video.addEventListener('play', checkState);
        }

        container.appendChild(btn);
        return btn;
    }



    function createBlurToggle() {
        if (document.querySelector("#noticing-game-netflix-blur")) {
            return document.querySelector("#noticing-game-netflix-blur");
        }

        const container = getPlayerContainer();
        let isBlurEnabled = false;

        const btn = document.createElement("button");
        btn.id = "noticing-game-netflix-blur";
        btn.className = "noticing-game-blur-toggle";

        Object.assign(btn.style, {
            position: "absolute",
            top: "calc(50% + 104px)",
            right: "12px",
            transform: "translateY(-50%)",
            zIndex: "10010",
            background: "none",
            border: "none",
            padding: "0",
            width: "48px",
            height: "48px",
            cursor: "pointer",
            display: "block"
        });

        btn.title = "Toggle Blur Subtitles";

        function getBlurSwitchSVG(on) {
            if (on) {
                return `
                  <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="35" cy="24" r="9" fill="rgba(101,68,233,0.35)"/>
                  </svg>
                `;
            } else {
                return `
                  <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:auto;">
                    <rect x="4" y="15" rx="9" ry="9" width="40" height="18" fill="rgba(101,68,233,0.18)"/>
                    <circle cx="13" cy="24" r="9" fill="rgba(255,255,255,0.35)"/>
                  </svg>
                `;
            }
        }

        // Init State
        chrome.storage.local.get(["blurSubtitles"], function (result) {
            isBlurEnabled = result.blurSubtitles || false;
            btn.innerHTML = getBlurSwitchSVG(isBlurEnabled);
        });

        // Listen changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.blurSubtitles) {
                isBlurEnabled = changes.blurSubtitles.newValue;
                btn.innerHTML = getBlurSwitchSVG(isBlurEnabled);
            }
        });

        btn.addEventListener("click", () => {
            isBlurEnabled = !isBlurEnabled;
            btn.innerHTML = getBlurSwitchSVG(isBlurEnabled);
            chrome.storage.local.set({ blurSubtitles: isBlurEnabled }, () => {
                if (typeof window.showStatusMessage === 'function') {
                    window.showStatusMessage(`Blur Subtitles: ${isBlurEnabled ? "ON" : "OFF"}`);
                }
            });
        });

        container.appendChild(btn);
        return btn;
    }

    // ... DOM extraction (previous Step 379) ...
    async function extractSubtitlesFromDOM() {
        return new Promise((resolve) => {
            resolve({
                success: true,
                liveCapture: true,
                subtitles: [],
                language: "detected",
                source: "netflix-dom"
            });
            startNetflixObserver();
        });
    }

    let observerInterval = null;
    function startNetflixObserver() {
        if (observerInterval) clearInterval(observerInterval);

        function checkSubtitles() {
            const els = document.querySelectorAll(SELECTORS.SUBTITLE_TEXT);
            if (els && els.length > 0) {
                let text = "";
                els.forEach(el => text += " " + el.textContent);
                text = text.trim();

                if (text && window.WordDetection && window.TextProcessing) {
                    chrome.storage.local.get(["frequencyWordList"], function (result) {
                        if (result.frequencyWordList) {
                            window.TextProcessing.processSubtitleTextForWordDetection(
                                text,
                                result.frequencyWordList,
                                function (word) {
                                    window.WordDetection.trackWordAppearance(word);
                                }
                            );
                        }
                    });
                }
            }
        }
        observerInterval = setInterval(checkSubtitles, 300);
    }

    return {
        waitForNetflixControls,
        createToggleButton,
        createPauseToggle,
        createBlurToggle,
        extractSubtitlesFromDOM
    };
})();
