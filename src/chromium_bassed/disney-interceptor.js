// Interceptor for Disney+ subtitle requests
// Runs in the MAIN world to access network APIs directly

(function () {
    console.log("Noticing Game: Disney+ Interceptor loaded");

    // Constants for detection
    // Disney+ uses various formats (VTT chunks, XML/TTML)
    const SUBTITLE_KEYWORDS = [
        "vtt",
        "xml",
        "ttml",
        "dfxp",
        "caption",
        "subtitle",
        "segment" // For chunked subtitles
    ];

    const isSubtitleUrl = (url) => {
        if (!url) return false;
        const urlStr = url.toString().toLowerCase();

        // Check for keywords
        const hasKeyword = SUBTITLE_KEYWORDS.some(k => urlStr.includes(k));

        // Exclude common non-subtitle assets
        const isImage = urlStr.includes(".jpg") || urlStr.includes(".png") || urlStr.includes(".css");
        const isVideo = urlStr.includes(".mp4") || urlStr.includes(".m4s") && !urlStr.includes("text"); // m4s can be media segment

        return hasKeyword && !isImage && !isVideo;
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
                // console.log("Noticing Game: Intercepted potential Disney+ subtitle XHR:", this._url);
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
            // console.log("Noticing Game: Intercepted potential Disney+ subtitle Fetch:", url);
            clone.text().then(content => {
                processContent(content, "fetch");
            }).catch(e => {
                // console.error("Noticing Game: Error processing Fetch response:", e);
            });
        }

        return response;
    };

    function processContent(content, source) {
        // Basic validation that it looks like subtitles
        if (content && (
            content.includes("WEBVTT") ||
            content.includes("<tt") ||
            content.includes("<div") ||
            content.includes("xml")
        )) {
            dispatchSubtitleEvent(content);
        }
    }

    function dispatchSubtitleEvent(content) {
        console.log(`Noticing Game: Dispatching Disney+ subtitle content (${content.length} bytes)`);
        let format = "xml";
        if (content.includes("WEBVTT")) format = "vtt";

        const event = new CustomEvent("NoticingGameDisneySubtitle", {
            detail: {
                content: content,
                format: format
            }
        });
        window.dispatchEvent(event);
    }

})();
