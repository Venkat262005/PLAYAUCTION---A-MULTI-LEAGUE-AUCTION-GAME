export const NATION_FLAGS = {
    "india": "in",
    "ind": "in",
    "australia": "au",
    "aus": "au",
    "south africa": "za",
    "sa": "za",
    "england": "gb",
    "eng": "gb",
    "new zealand": "nz",
    "nz": "nz",
    "west indies": "wi",
    "wi": "wi",
    "afghanistan": "af",
    "afg": "af",
    "sri lanka": "lk",
    "sl": "lk",
    "bangladesh": "bd",
    "ban": "bd",
    "ireland": "ie",
    "ire": "ie",
    "zimbabwe": "zw",
    "zim": "zw",
    "netherlands": "nl",
    "ned": "nl",
    "scotland": "gb-sct",
    "sco": "gb-sct",
    "nepal": "np",
    "usa": "us",
    "canada": "ca",
    "oman": "om",
    "uae": "ae",
    "namibia": "na",
    "unknown": null
};

export const getFlagUrl = (nationality) => {
    if (!nationality) return null;
    const cleanNation = nationality.toLowerCase().trim()
        .replace(/\./g, '') // Remove dots (e.g., S.A -> SA)
        .replace(/\s+/g, ' '); // Normalize spaces

    // Try direct mapping
    let code = NATION_FLAGS[cleanNation];

    // Try substring matching if no direct hit
    if (!code) {
        if (cleanNation.includes("india")) code = "in";
        else if (cleanNation.includes("australia")) code = "au";
        else if (cleanNation.includes("south africa") || cleanNation === "sa") code = "za";
        else if (cleanNation.includes("england")) code = "gb";
        else if (cleanNation.includes("new zealand") || cleanNation === "nz") code = "nz";
        else if (cleanNation.includes("indies") || cleanNation === "wi") code = "wi";
        else if (cleanNation.includes("afghanistan") || cleanNation === "afg") code = "af";
        else if (cleanNation.includes("sri lanka") || cleanNation === "sl") code = "lk";
        else if (cleanNation.includes("bangladesh") || cleanNation === "ban") code = "bd";
    }

    if (!code && !cleanNation.includes("indies")) return null;

    // West Indies specific handling (using their official cricket logo)
    if (code === "wi" || cleanNation.includes("indies")) {
        return "https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Cricket_West_Indies_logo.svg/200px-Cricket_West_Indies_logo.svg.png";
    }

    if (!code) return null;
    return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
};

export const getRoleDisplayName = (role) => {
    if (!role) return "BAT";
    const r = role.toLowerCase();
    if (r.includes("bat") || r.includes("bt")) return "BAT";
    if (r.includes("bowl") || r.includes("bw")) return "BOWL";
    if (r.includes("all") || r.includes("ar")) return "AR";
    if (r.includes("wk") || r.includes("wicket") || r.includes("keeper")) return "WK";
    return "BAT"; // Default
};

/** Returns a usable player photo URL, or null if the stored value is missing/broken. */
export const resolvePlayerImageUrl = (player) => {
    const url = player?.image_path || player?.imagepath || player?.photoUrl;
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('data:') && !url.includes('base64,')) return null;
    // Skip incomplete CDN paths that only contain transform flags
    if (/hscicdn\.com\/image\/upload\/f_auto\/?$/i.test(url)) return null;
    if (url.length < 45) return null;
    return url;
};

export const getPlayerImageFallback = (player) => {
    const seed = encodeURIComponent(player?.player || player?.name || 'Player');
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=1a1205`;
};

/**
 * Currency configuration for each league.
 * Purses are stored internally in "Lakhs" of the primary currency.
 * 
 * IPL / WPL → INR (₹), 1 Lakh = ₹1,00,000
 * SA20      → ZAR (R), 1 Lakh = R1,00,000
 * USD mode  → converts at fixed game rates (for fun/simplicity)
 */
export const CURRENCY_CONFIG = {
    inr: { symbol: '₹', label: 'INR', unit: 'Cr', name: 'Indian Rupee',     usdPerCr: 120000 },
    zar: { symbol: 'R', label: 'ZAR', unit: 'M',  name: 'S.A. Rand',        usdPerCr: 540000 },
    usd: { symbol: '$', label: 'USD', unit: 'M',  name: 'US Dollar',         usdPerCr: null   },
};

/** Default currency per league */
export const LEAGUE_DEFAULTS = {
    ipl:  'inr',
    wpl:  'inr',
    sa20: 'zar',
};

/**
 * fmtCr — formats an internal Lakhs value to a display string.
 *
 * @param {number} lakhs   — internal stored amount in Lakhs of primary currency
 * @param {string} currency — 'inr' | 'zar' | 'usd' (defaults to 'inr')
 *
 * Examples (INR):  200L → "₹2Cr"  |  150L → "₹1.5Cr"  |  50L → "₹50L"
 * Examples (ZAR):  410L → "R41M"  |  65L → "R6.5M"  |  8.5L → "R850K"
 * Examples (USD):  12000L INR → "$14.4M"
 */
export const fmtCr = (lakhs, currency = 'inr', sourceCurrency = 'inr') => {
    if (lakhs === undefined || lakhs === null) return `${CURRENCY_CONFIG[currency]?.symbol || '₹'}0${CURRENCY_CONFIG[currency]?.unit || 'Cr'}`;

    const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.inr;

    if (currency === 'usd') {
        // USD display: convert from Lakhs (of INR or ZAR) to USD millions
        // 1 Cr INR = 100 Lakhs ≈ $120,000 → 1 Lakh INR ≈ $1,200
        // 1 Cr ZAR = 100 Lakhs ≈ $54,000 → 1 Lakh ZAR ≈ $540
        const usdRatePerCr = CURRENCY_CONFIG[sourceCurrency]?.usdPerCr || 120000;
        const totalDollars = (lakhs / 100) * usdRatePerCr;
        const millions = totalDollars / 1000000;

        if (millions >= 1) {
            const formatted = parseFloat(millions.toFixed(2));
            return `$${formatted}M`;
        } else {
            const k = parseFloat((millions * 1000).toFixed(0));
            const roundedK = Math.max(10, Math.round(k / 10) * 10);
            return `$${roundedK}K`;
        }
    }

    if (currency === 'zar') {
        // ZAR display: convert from internal Lakhs (where 10 Lakhs = 1M ZAR, so 1 Lakh = 100K ZAR)
        const millions = lakhs / 10;
        if (millions >= 1) {
            const formatted = parseFloat(millions.toFixed(2));
            return `R${formatted}M`;
        } else {
            const k = parseFloat((millions * 1000).toFixed(0));
            return `R${k}K`;
        }
    }

    // INR or standard Crore format:
    const cr = lakhs / 100;
    if (cr >= 1) {
        const formatted = parseFloat(cr.toFixed(2));
        return `${cfg.symbol}${formatted}Cr`;
    } else {
        // Show in Lakhs for small amounts
        const formatted = parseFloat(lakhs.toFixed(1));
        return `${cfg.symbol}${formatted}L`;
    }
};

/** Get just the symbol for a currency code */
export const getCurrencySymbol = (currency = 'inr') => {
    return CURRENCY_CONFIG[currency]?.symbol || '₹';
};

/** Get the short label for a currency code */
export const getCurrencyLabel = (currency = 'inr') => {
    return CURRENCY_CONFIG[currency]?.label || 'INR';
};

/** Get the display name for a currency code */
export const getCurrencyName = (currency = 'inr') => {
    return CURRENCY_CONFIG[currency]?.name || 'Indian Rupee';
};

let ratesFetched = false;
export const fetchLiveExchangeRates = async () => {
    if (ratesFetched) return;
    try {
        console.log("[CURRENCY] Fetching live exchange rates from open.er-api.com...");
        const response = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!response.ok) throw new Error("Failed to fetch exchange rates");
        const data = await response.json();
        
        if (data && data.rates) {
            const inrRate = data.rates.INR;
            const zarRate = data.rates.ZAR;
            
            if (inrRate) {
                // 1 Crore = 10,000,000 INR
                CURRENCY_CONFIG.inr.usdPerCr = Math.round(10000000 / inrRate);
                console.log(`[CURRENCY] Live INR Rate: 1 USD = ${inrRate} INR. Calculated usdPerCr: ${CURRENCY_CONFIG.inr.usdPerCr}`);
            }
            if (zarRate) {
                // 1 Crore = 10,000,000 ZAR
                CURRENCY_CONFIG.zar.usdPerCr = Math.round(10000000 / zarRate);
                console.log(`[CURRENCY] Live ZAR Rate: 1 USD = ${zarRate} ZAR. Calculated usdPerCr: ${CURRENCY_CONFIG.zar.usdPerCr}`);
            }
            ratesFetched = true;
        }
    } catch (err) {
        console.warn("[CURRENCY] Failed to fetch live exchange rates, using corrected built-in ratios:", err.message);
    }
};
