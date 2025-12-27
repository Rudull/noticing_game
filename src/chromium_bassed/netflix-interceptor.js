// Interceptor for Netflix subtitle requests
// Runs in the MAIN world to access network APIs directly

(function () {
    console.log("Noticing Game: Netflix Interceptor loaded");

    // Constants for detection
    const SUBTITLE_PATTERNS = [
        "/?o=", // Common Netflix timed text parameter
        ".xml",
        ".dfxp",
        ".vtt",
        "/range/"
    ];

    const isSubtitleUrl = (url) => {
        if (!url) return false;
        const urlStr = url.toString();
        // Broader detection for Netflix subtitle URLs
        // They typically contain ?o= parameter for signed URLs
        // And usually end in specific formats or content types, but URL params make extensions hard to match at end

        const isNetflixCDN = urlStr.includes("nflxvideo.net") || urlStr.includes("nflxso.net") || urlStr.includes("netflix.com");
        const hasTimedTextParam = urlStr.includes("?o=") || urlStr.includes("&o=");
        const hasSubtitleKeyword = urlStr.includes("/timedtext") || urlStr.includes("dfxp") || urlStr.includes("xml") || urlStr.includes("vtt");

        return (isNetflixCDN && hasTimedTextParam) || (hasSubtitleKeyword && isNetflixCDN);
    };

    // --- XHR Interception ---
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method, url) {
        this._method = method;
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function (postData) {
        this.addEventListener("load", function () {
            if (this._url && isSubtitleUrl(this._url)) {
                console.log("Noticing Game: Intercepted potential subtitle XHR:", this._url);
                try {
                    const content = this.responseText;
                    processContent(content, "xhr");
                } catch (e) {
                    console.error("Noticing Game: Error processing XHR response:", e);
                }
            }
        });
        return send.apply(this, arguments);
    };

    // --- Fetch Interception ---
    const originalFetch = window.fetch;
    window.fetch = async function () {
        const url = arguments[0];

        // Call original fetch
        const response = await originalFetch.apply(this, arguments);

        // Clone to read body without consuming it for the app
        if (isSubtitleUrl(url)) {
            const clone = response.clone();
            console.log("Noticing Game: Intercepted potential subtitle Fetch:", url);
            clone.text().then(content => {
                processContent(content, "fetch");
            }).catch(e => {
                console.error("Noticing Game: Error processing Fetch response:", e);
            });
        }

        return response;
    };

    function processContent(content, source) {
        if (content && (content.includes("<tt") || content.includes("<div") || content.includes("WEBVTT"))) {
            dispatchSubtitleEvent(content, source);
        }
    }

    function dispatchSubtitleEvent(content, source) {
        console.log(`Noticing Game: Dispatching subtitle content (${content.length} bytes) from ${source}`);
        const event = new CustomEvent("NoticingGameNetflixSubtitle", {
            detail: {
                content: content,
                format: content.includes("WEBVTT") ? "vtt" : "xml"
            }
        });
        window.dispatchEvent(event);
    }

    // --- Retroactive Check (for missed requests) ---
    function checkMissedSubtitles() {
        console.log("Noticing Game: Checking for missed subtitles in performance entries...");
        const entries = performance.getEntriesByType("resource");

        // Find latest subtitle looking URL
        const subtitleEntries = entries.filter(e => isSubtitleUrl(e.name));

        if (subtitleEntries.length > 0) {
            // Sort by start time descending to get most recent
            subtitleEntries.sort((a, b) => b.startTime - a.startTime);
            const latest = subtitleEntries[0];

            console.log("Noticing Game: Found missed subtitle URL:", latest.name);

            // Try to fetch it (should be in cache)
            originalFetch(latest.name)
                .then(res => res.text())
                .then(content => {
                    processContent(content, "retroactive-fetch");
                })
                .catch(err => console.error("Noticing Game: Failed to retro-fetch subtitle:", err));
        } else {
            console.log("Noticing Game: No missed subtitle URLs found.");
        }
    }

    // Check shortly after load and periodically
    setTimeout(checkMissedSubtitles, 3000);
    setTimeout(checkMissedSubtitles, 8000); // Check again later just in case

})();
