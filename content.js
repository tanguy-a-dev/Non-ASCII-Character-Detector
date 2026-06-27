(function () {

    const DEFAULT_ALLOWED_CHARS = "àçèéêëôïîùûüÀÇÈÉÊËÎÏÔÙÛÜ€$©";

    // Exit immediately if the extension has been turned off by the user
    chrome.storage.sync.get({ enabled: true, allowedChars: DEFAULT_ALLOWED_CHARS }, ({ enabled, allowedChars }) => {
        if (enabled) init(allowedChars);
    });

    function init(allowedChars) {

    // ── Constants ────────────────────────────────────────────────────────

    // Escape regex metacharacters so arbitrary user-supplied chars stay literal inside [...]
    const ALLOWED_CHARS = allowedChars.replace(/[\\\]^-]/g, "\\$&");

    // No `g` flag — stateless, safe to reuse. Use makeGlobalRe() where needed.
    const RE = new RegExp(`[^\x00-\x7F${ALLOWED_CHARS}]`);

    const SEARCH_ENGINES = [
        /^https:\/\/www\.google\.[a-z.]+\/search/,
        /^https:\/\/www\.bing\.com\/search/,
        /^https:\/\/search\.yahoo\.com\/search/,
        /^https:\/\/duckduckgo\.com\//,
        /^https:\/\/search\.brave\.com\/search/,
    ];

    const NAV_FADE_DELAY    = 3000; // ms before counter fades
    const NAV_FADE_DURATION = 400;  // ms for the fade transition (must match CSS)
    const SPA_DEBOUNCE      = 300;  // ms to wait after URL change before re-analyzing

    // ── Helpers ──────────────────────────────────────────────────────────

    const makeGlobalRe = () => new RegExp(RE.source, "g");

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function toUnicodeLabel(char) {
        return "U+" + char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    }

    function charBadgeHtml(char) {
        const safe = escapeHtml(char);
        return `<span class="non-ascii-char" data-char="${safe}" title="${toUnicodeLabel(char)}">${safe}</span>`;
    }

    // ── DOM ──────────────────────────────────────────────────────────────

    function buildBox(totalCount, uniqueChars) {
        const box = document.createElement("div");
        box.className = "non-ascii-box";
        box.innerHTML = `
            <div class="non-ascii-header">
                <span class="non-ascii-title">non-ascii characters</span>
                <button class="non-ascii-close" aria-label="Dismiss">✕</button>
            </div>
            <div class="non-ascii-counts">
                <span>${totalCount} occurrence${totalCount !== 1 ? "s" : ""}</span>
                <span class="non-ascii-sep">·</span>
                <span>${uniqueChars.length} unique</span>
            </div>
            <div class="non-ascii-actions">
                <button class="non-ascii-button" data-action="show">show</button>
                <button class="non-ascii-button" data-action="highlight">highlight</button>
            </div>
            <div class="non-ascii-list">
                ${uniqueChars.map(charBadgeHtml).join("")}
            </div>
        `;
        return box;
    }

    function removeBox() {
        document.querySelector(".non-ascii-box")?.remove();
    }

    // ── Highlights ───────────────────────────────────────────────────────

    // Walk text nodes in root, wrap each non-ASCII match in <mark>,
    // and return a char → mark[] index built in a single pass.
    function applyHighlights(root) {
        const index  = {};
        const re     = makeGlobalRe();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (node.parentElement?.closest(".non-ascii-box, script, style"))
                    return NodeFilter.FILTER_REJECT;
                return RE.test(node.nodeValue)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        });

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) textNodes.push(node);

        for (const textNode of textNodes) {
            const val  = textNode.nodeValue;
            const frag = document.createDocumentFragment();
            let last   = 0;
            re.lastIndex = 0;
            let match;

            while ((match = re.exec(val)) !== null) {
                if (match.index > last)
                    frag.appendChild(document.createTextNode(val.slice(last, match.index)));

                const mark = document.createElement("mark");
                mark.className  = "non-ascii-highlight";
                mark.textContent = match[0];
                frag.appendChild(mark);

                (index[match[0]] ??= []).push(mark);
                last = re.lastIndex;
            }

            if (last < val.length)
                frag.appendChild(document.createTextNode(val.slice(last)));

            textNode.parentNode.replaceChild(frag, textNode);
        }

        return index;
    }

    function removeHighlights(root) {
        root.querySelectorAll("mark.non-ascii-highlight")
            .forEach(mark => mark.replaceWith(mark.firstChild));
    }

    // ── Navigation counter ───────────────────────────────────────────────

    function showNavCounter(badge, current, total) {
        badge.dataset.nav = `${current + 1}/${total}`;
        badge.classList.add("has-nav");
        badge.classList.remove("nav-fading");
    }

    function scheduleNavFade(badge, char, navIndex, navTimers) {
        clearTimeout(navTimers[char]);
        navTimers[char] = setTimeout(() => {
            badge.classList.add("nav-fading");
            setTimeout(() => {
                badge.classList.remove("has-nav", "nav-fading");
                delete navIndex[char];
            }, NAV_FADE_DURATION);
        }, NAV_FADE_DELAY);
    }

    // ── Core ─────────────────────────────────────────────────────────────

    function analyze(root) {
        removeBox();

        if (!RE.test(root.textContent)) return;

        const rawMatches = root.textContent.match(makeGlobalRe());
        const uniqueChars = [...new Set(rawMatches)];
        const totalCount  = rawMatches.length;

        const box = buildBox(totalCount, uniqueChars);
        document.body.appendChild(box);

        const showBtn      = box.querySelector("[data-action='show']");
        const highlightBtn = box.querySelector("[data-action='highlight']");
        const list         = box.querySelector(".non-ascii-list");
        const closeBtn     = box.querySelector(".non-ascii-close");

        let highlightActive = false;
        let markIndex       = {};
        let focusedMark     = null;
        const navIndex      = {};
        const navTimers     = {};

        function ensureHighlights() {
            if (highlightActive) return;
            markIndex       = applyHighlights(root);
            highlightActive = true;
            highlightBtn.classList.add("is-active");
            highlightBtn.textContent = "unhighlight";
        }

        function clearFocused() {
            focusedMark?.classList.remove("is-focused");
            focusedMark = null;
        }

        function disableHighlights() {
            clearFocused();
            removeHighlights(root);
            markIndex       = {};
            highlightActive = false;
            highlightBtn.classList.remove("is-active");
            highlightBtn.textContent = "highlight";
        }

        function navigateToChar(badge) {
            const char  = badge.dataset.char;
            const marks = markIndex[char];
            if (!marks?.length) return;

            navIndex[char] = navIndex[char] === undefined
                ? 0
                : (navIndex[char] + 1) % marks.length;

            clearFocused();
            focusedMark = marks[navIndex[char]];
            focusedMark.classList.add("is-focused");
            focusedMark.scrollIntoView({ behavior: "smooth", block: "center" });

            showNavCounter(badge, navIndex[char], marks.length);
            scheduleNavFade(badge, char, navIndex, navTimers);
        }

        showBtn.addEventListener("click", () => {
            const isOpen = list.classList.toggle("is-open");
            showBtn.textContent = isOpen ? "hide" : "show";
        });

        highlightBtn.addEventListener("click", () => {
            highlightActive ? disableHighlights() : ensureHighlights();
        });

        list.addEventListener("click", e => {
            const badge = e.target.closest(".non-ascii-char");
            if (!badge) return;
            ensureHighlights();
            navigateToChar(badge);
        });

        closeBtn.addEventListener("click", () => {
            if (highlightActive) removeHighlights(root);
            box.remove();
        });
    }

    // ── Navigation strategies ────────────────────────────────────────────

    function initGmail() {
        let lastRoot = null;

        new MutationObserver(() => {
            const root = document.querySelector(".a3s");
            if (root && root !== lastRoot) {
                if (lastRoot) removeHighlights(lastRoot);
                lastRoot = root;
                analyze(root);
            } else if (!root && lastRoot) {
                lastRoot = null;
                removeBox();
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    function initAstro() {
        // astro:page-load fires after DOM swap — no debounce needed
        document.addEventListener("astro:page-load", () => analyze(document.body));
        analyze(document.body);
    }

    function initGenericSpa() {
        let currentUrl = location.href;
        let timer      = null;

        function onUrlChange() {
            clearTimeout(timer);
            timer = setTimeout(() => analyze(document.body), SPA_DEBOUNCE);
        }

        const _push    = history.pushState.bind(history);
        const _replace = history.replaceState.bind(history);
        history.pushState    = (...args) => { _push(...args);    onUrlChange(); };
        history.replaceState = (...args) => { _replace(...args); onUrlChange(); };
        window.addEventListener("popstate", onUrlChange);

        // Fallback: watch <head> for title changes (lighter than body subtree)
        new MutationObserver(() => {
            if (location.href !== currentUrl) {
                currentUrl = location.href;
                onUrlChange();
            }
        }).observe(document.head, { childList: true });

        analyze(document.body);
    }

    // ── Entry point ──────────────────────────────────────────────────────

    if (SEARCH_ENGINES.some(re => re.test(location.href))) return;

    if (location.hostname === "mail.google.com") {
        initGmail();
    } else if (document.querySelector("meta[name='astro-view-transitions-enabled']")) {
        initAstro();
    } else {
        initGenericSpa();
    }

    } // init

})();