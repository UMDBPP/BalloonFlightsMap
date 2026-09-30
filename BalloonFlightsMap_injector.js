let BalloonFlightsMap_import_mappings = {
    "BalloonBaseMap":               (new URL("BalloonBaseMap/BalloonBaseMap.js", document.currentScript.src)).href,
    "chart.js":                     "https://cdn.jsdelivr.net/npm/chart.js@4.5.0/+esm",
    "date-fns":                     "https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm",
    // "chartjs-adapter-date-fns":     "https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/+esm"
    "chartjs-adapter-date-fns":     (new URL("assets/components/chartjs-adapter-date-fns.js", document.currentScript.src)).href,
}

let BalloonFlightsMap_css_links = [
    (new URL("assets/BalloonFlightsMap.css", document.currentScript.src)).href,
]

async function inject_BalloonFlightsMap() {
    let importmap_el = document.createElement('script');
    importmap_el.type = "importmap";
    importmap_el.appendChild(document.createTextNode(JSON.stringify({
        "imports": {
            ...BalloonBaseMap_import_mappings,
            ...BalloonFlightsMap_import_mappings
        }
    })));
    document.head.appendChild(importmap_el);

    function get_injected_css(url) {
        let link_el = document.createElement('link');
        link_el.href = url;
        link_el.rel = 'stylesheet';
        link_el.type = 'text/css';
        return link_el;
    }

    BalloonFlightsMap_css_links = [
        ...BalloonBaseMap_css_links,
        ...BalloonFlightsMap_css_links
    ];

    BalloonFlightsMap_css_links.forEach((url, index) => {
        document.head.appendChild(get_injected_css(url));
    });
}
