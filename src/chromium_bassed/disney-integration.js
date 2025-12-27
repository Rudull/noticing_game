// Módulo de integración con Disney+ para Noticing Game (Floating UI like YouTube)
window.DisneyIntegration = (function () {

    const SELECTORS = {
        POSSIBLE_SUBTITLES: [
            '.dss-subtitle-renderer',
            '.shutter-subtitle-container',
            '.closed-captions-renderer',
            '[class*="subtitle" i]',
            '[class*="caption" i]'
        ]
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
        const video = document.querySelector('video');
        if (video && video.parentNode) {
            return video.parentNode;
        }
        return document.body;
    }

    function createToggleButton(callback) {
        if (document.querySelector("#noticing-game-disney-toggle")) return document.querySelector("#noticing-game-disney-toggle");

        const container = getPlayerContainer();
        let isSwitchOn = false;
        if (window.NoticingGamePanel && typeof window.NoticingGamePanel.isOpen === "function") {
            isSwitchOn = window.NoticingGamePanel.isOpen();
        }

        const btn = document.createElement("button");
        btn.id = "noticing-game-disney-toggle";
        btn.className = "noticing-game-floating-toggle";

        Object.assign(btn.style, {
            position: "absolute",
            top: "50%",
            right: "12px",
            transform: "translateY(-50%)",
            zIndex: "2147483647", // Max Z-Index
            background: "none",
            border: "none",
            padding: "0",
            width: "48px", // Ensure size for hover target
            height: "48px",
            itemAlign: "center",
            display: "flex", // Flex for centering SVG
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            pointerEvents: "auto"
        });

        btn.title = "Show/Hide Noticing Game";
        btn.innerHTML = getSwitchSVG(isSwitchOn);

        btn.addEventListener("click", () => {
            // ... Logic ...
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
        if (document.querySelector("#noticing-game-disney-pause")) return document.querySelector("#noticing-game-disney-pause");

        const container = getPlayerContainer();
        let isPauseTimeEnabled = false;
        let isVideoPaused = false;

        const btn = document.createElement("button");
        btn.id = "noticing-game-disney-pause";
        btn.className = "noticing-game-pause-toggle";

        Object.assign(btn.style, {
            position: "absolute",
            top: "calc(50% + 52px)",
            right: "12px",
            transform: "translateY(-50%)",
            zIndex: "2147483647",
            background: "none",
            border: "none",
            padding: "0",
            width: "48px",
            height: "48px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            pointerEvents: "auto"
        });

        // Ensure title attribute is set on the button element directly
        btn.setAttribute("title", "Enable/Disable Time Pause on Stop");

        function updateSVG() {
            btn.innerHTML = createPauseToggleSVG(isPauseTimeEnabled, isVideoPaused);
        }

        chrome.storage.local.get(["pauseTimeWhenVideoStops"], function (result) {
            isPauseTimeEnabled = result.pauseTimeWhenVideoStops || false;
            updateSVG();
        });

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
        });

        const video = document.querySelector('video');
        if (video) {
            const checkState = () => {
                const newPaused = video.paused || video.ended;
                if (newPaused !== isVideoPaused) {
                    isVideoPaused = newPaused;
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

    // Include Blur button for consistency (and in case user asks later/notices)
    function createBlurToggle() {
        if (document.querySelector("#noticing-game-disney-blur")) return document.querySelector("#noticing-game-disney-blur");

        const container = getPlayerContainer();
        let isBlurEnabled = false;

        const btn = document.createElement("button");
        btn.id = "noticing-game-disney-blur";
        btn.className = "noticing-game-blur-toggle";

        Object.assign(btn.style, {
            position: "absolute",
            top: "calc(50% + 104px)",
            right: "12px",
            transform: "translateY(-50%)",
            zIndex: "2147483647",
            background: "none",
            border: "none",
            padding: "0",
            width: "48px",
            height: "48px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            pointerEvents: "auto"
        });

        btn.setAttribute("title", "Toggle Blur Subtitles");

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

        chrome.storage.local.get(["blurSubtitles"], function (result) {
            isBlurEnabled = result.blurSubtitles || false;
            btn.innerHTML = getBlurSwitchSVG(isBlurEnabled);
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.blurSubtitles) {
                isBlurEnabled = changes.blurSubtitles.newValue;
                btn.innerHTML = getBlurSwitchSVG(isBlurEnabled);
            }
        });

        btn.addEventListener("click", () => {
            isBlurEnabled = !isBlurEnabled;
            btn.innerHTML = getBlurSwitchSVG(isBlurEnabled);
            chrome.storage.local.set({ blurSubtitles: isBlurEnabled });
        });

        container.appendChild(btn);
        return btn;
    }


    async function extractSubtitlesFromDOM() {
        return new Promise((resolve) => {
            resolve({
                success: true,
                liveCapture: true,
                subtitles: [],
                language: "detected",
                source: "disney-dom"
            });
            startDisneyObserver();
        });
    }

    let observerInterval = null;
    function startDisneyObserver() {
        if (observerInterval) clearInterval(observerInterval);

        function checkSubtitles() {
            let text = "";
            for (const selector of SELECTORS.POSSIBLE_SUBTITLES) {
                const els = document.querySelectorAll(selector);
                if (els.length > 0) {
                    els.forEach(el => text += " " + el.textContent);
                }
            }
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
        observerInterval = setInterval(checkSubtitles, 300);
    }

    return {
        createToggleButton,
        createPauseToggle,
        createBlurToggle,
        extractSubtitlesFromDOM
    };

})();
