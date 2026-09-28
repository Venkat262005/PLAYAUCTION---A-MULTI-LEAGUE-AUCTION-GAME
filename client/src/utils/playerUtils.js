export const NATION_FLAGS = {
    // India
    "india": "in",
    "ind": "in",
    "in": "in",

    // Australia
    "australia": "au",
    "aus": "au",
    "au": "au",

    // South Africa / RSA
    "south africa": "za",
    "southafrica": "za",
    "sa": "za",
    "rsa": "za",
    "saf": "za",
    "za": "za",

    // England / Great Britain
    "england": "gb-eng",
    "eng": "gb-eng",
    "great britain": "gb",
    "britain": "gb",
    "uk": "gb",
    "gb": "gb",

    // New Zealand
    "new zealand": "nz",
    "newzealand": "nz",
    "nz": "nz",
    "nzl": "nz",

    // West Indies
    "west indies": "wi",
    "westindies": "wi",
    "wi": "wi",
    "win": "wi",
    "windies": "wi",
    "caribbean": "wi",

    // Pakistan
    "pakistan": "pk",
    "pak": "pk",
    "pk": "pk",

    // Sri Lanka
    "sri lanka": "lk",
    "srilanka": "lk",
    "sl": "lk",
    "lka": "lk",
    "lk": "lk",

    // Afghanistan
    "afghanistan": "af",
    "afg": "af",
    "af": "af",

    // Bangladesh
    "bangladesh": "bd",
    "ban": "bd",
    "bd": "bd",
    "bgd": "bd",

    // Ireland
    "ireland": "ie",
    "ire": "ie",
    "ie": "ie",
    "irl": "ie",

    // Zimbabwe
    "zimbabwe": "zw",
    "zim": "zw",
    "zw": "zw",
    "zwe": "zw",

    // Netherlands
    "netherlands": "nl",
    "ned": "nl",
    "nl": "nl",
    "nld": "nl",
    "holland": "nl",

    // Scotland
    "scotland": "gb-sct",
    "sco": "gb-sct",
    "gb-sct": "gb-sct",
    "sct": "gb-sct",

    // Estonia
    "estonia": "ee",
    "est": "ee",
    "ee": "ee",

    // Nepal
    "nepal": "np",
    "nep": "np",
    "np": "np",

    // USA / United States
    "usa": "us",
    "united states": "us",
    "us": "us",

    // Canada
    "canada": "ca",
    "can": "ca",
    "ca": "ca",

    // Oman
    "oman": "om",
    "omn": "om",
    "om": "om",

    // UAE / United Arab Emirates
    "uae": "ae",
    "united arab emirates": "ae",
    "ae": "ae",
    "are": "ae",

    // Namibia
    "namibia": "na",
    "nam": "na",
    "na": "na",

    // Kenya
    "kenya": "ke",
    "ken": "ke",
    "ke": "ke",

    // Papua New Guinea
    "papua new guinea": "pg",
    "png": "pg",
    "pg": "pg",

    // Uganda
    "uganda": "ug",
    "uga": "ug",
    "ug": "ug",

    // Hong Kong
    "hong kong": "hk",
    "hk": "hk",
    "hkg": "hk",

    // Bermuda
    "bermuda": "bm",
    "ber": "bm",
    "bm": "bm",

    // Italy
    "italy": "it",
    "ita": "it",
    "it": "it",

    // Singapore
    "singapore": "sg",
    "sg": "sg",
    "sgp": "sg",

    "unknown": null
};

export const getFlagUrl = (nationality) => {
    if (!nationality) return null;
    const cleanNation = nationality.toLowerCase().trim()
        .replace(/\./g, '') // Remove dots (e.g., S.A -> SA, U.S.A -> USA)
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' '); // Normalize spaces

    // Try direct mapping
    let code = NATION_FLAGS[cleanNation];

    // Try substring matching if no direct hit
    if (!code) {
        if (cleanNation.includes("india")) code = "in";
        else if (cleanNation.includes("australia")) code = "au";
        else if (cleanNation.includes("south africa") || cleanNation === "sa" || cleanNation === "rsa" || cleanNation === "saf") code = "za";
        else if (cleanNation.includes("england") || cleanNation === "eng") code = "gb-eng";
        else if (cleanNation.includes("new zealand") || cleanNation === "nz") code = "nz";
        else if (cleanNation.includes("indies") || cleanNation === "wi" || cleanNation === "windies") code = "wi";
        else if (cleanNation.includes("pakistan") || cleanNation === "pak") code = "pk";
        else if (cleanNation.includes("afghanistan") || cleanNation === "afg") code = "af";
        else if (cleanNation.includes("sri lanka") || cleanNation === "sl" || cleanNation === "lka") code = "lk";
        else if (cleanNation.includes("bangladesh") || cleanNation === "ban") code = "bd";
        else if (cleanNation.includes("zimbabwe") || cleanNation === "zim") code = "zw";
        else if (cleanNation.includes("ireland") || cleanNation === "ire") code = "ie";
        else if (cleanNation.includes("netherlands") || cleanNation === "dutch" || cleanNation === "ned") code = "nl";
        else if (cleanNation.includes("scotland") || cleanNation === "sco") code = "gb-sct";
        else if (cleanNation.includes("estonia") || cleanNation === "est") code = "ee";
        else if (cleanNation.includes("united states") || cleanNation === "usa" || cleanNation === "us") code = "us";
        else if (cleanNation.includes("canada") || cleanNation === "can") code = "ca";
        else if (cleanNation.includes("nepal") || cleanNation === "nep") code = "np";
        else if (cleanNation.includes("oman")) code = "om";
        else if (cleanNation.includes("emirates") || cleanNation === "uae") code = "ae";
        else if (cleanNation.includes("namibia")) code = "na";
        else if (cleanNation.includes("kenya")) code = "ke";
        else if (cleanNation.includes("guinea") || cleanNation === "png") code = "pg";
        else if (cleanNation.includes("uganda")) code = "ug";
        else if (cleanNation.includes("hong kong")) code = "hk";
        else if (cleanNation.includes("bermuda")) code = "bm";
        else if (cleanNation.includes("italy")) code = "it";
        else if (cleanNation.includes("singapore")) code = "sg";
    }

    if (!code) return null;

    // West Indies local SVG flag (avoids 403 forbidden hotlink blocks)
    if (code === "wi") {
        return "/flags/wi.svg";
    }

    return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
};

export const getPlayerHandedness = (player) => {
    if (!player) return '';
    const rawBat = player.batting_style || player['batting style'] || player.Batting_Style || player['Batting Style'] || '';
    if (rawBat) {
        const lower = String(rawBat).toLowerCase().trim();
        if (lower.includes('left') || lower === 'lhb') return 'Left Handed';
        if (lower.includes('right') || lower === 'rhb') return 'Right Handed';
    }
    const rawBowl = player.bowling_style || player['bowling style'] || player.Bowling_Style || player['Bowling Style'] || '';
    if (rawBowl) {
        const lower = String(rawBowl).toLowerCase().trim();
        if (lower.includes('left') || lower.includes('lbg') || lower.includes('sla')) return 'Left Handed';
        if (lower.includes('right') || lower.includes('ob') || lower.includes('leg break')) return 'Right Handed';
    }
    return '';
};

export const getRoleDisplayName = (role, player = null) => {
    let baseRole = "BAT";
    if (role) {
        const r = role.toLowerCase();
        if (r.includes("all") || r.includes("ar")) baseRole = "AR";
        else if (r.includes("wk") || r.includes("wicket") || r.includes("keeper")) baseRole = "WK";
        else if (r.includes("bowl") || r.includes("bw")) baseRole = "BOWL";
        else if (r.includes("bat") || r.includes("bt")) baseRole = "BAT";
    }

    if (!player) return baseRole;

    const handedness = getPlayerHandedness(player);
    if (!handedness) return baseRole;

    const isLeft = handedness.toLowerCase().includes("left");
    const prefix = isLeft ? "LH" : "RH";

    return `${prefix} ${baseRole}`;
};

/** Returns a usable player photo URL, or null if the stored value is missing/broken. */
export const resolvePlayerImageUrl = (player) => {
    const url = player?.image_path || player?.imagepath || player?.photoUrl;
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('data:') && !url.includes('base64,')) return null;
    // Skip incomplete CDN paths that only contain transform flags
    if (/hscicdn\.com\/image\/upload\/f_auto\/?$/i.test(url)) return null;
    // Allow relative paths or standard absolute URLs
    if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return null;
};

export const getPlayerImageFallback = (player) => {
    const seed = encodeURIComponent(player?.player || player?.name || 'Player');
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=1a1205`;
};

export const getPlayerBattingPosition = (player) => {
    if (!player) return '';
    const raw = player.batting_position || player.position || player['batting position'] || player['Batting Position'] || '';
    if (!raw) return '';
    const lower = String(raw).toLowerCase().trim();
    if (lower.includes('top')) return 'Top Order';
    if (lower.includes('finisher') || lower.includes('finish')) return 'Finisher';
    if (lower.includes('middle') && lower.includes('lower')) return 'Middle/Lower Order';
    if (lower.includes('middle')) return 'Middle Order';
    if (lower.includes('lower') || lower.includes('tail')) return 'Lower Order';
    return String(raw).trim();
};

export const getPlayerBowlingType = (player) => {
    if (!player) return '';
    const raw = player.bowling_type || player['bowling type'] || player['Bowling Type'] || '';
    if (raw) {
        const lower = String(raw).toLowerCase().trim();
        if (lower.includes('spin')) return 'Spin';
        if (lower.includes('pace') || lower.includes('fast') || lower.includes('medium') || lower.includes('seam')) return 'Pace';
        return String(raw).trim();
    }
    const role = (player.role || player.Role || player.Specialism || '').toLowerCase();
    const style = (player.bowling_style || player['bowling style'] || player.Bowling_Style || '').toLowerCase();
    if (role.includes('spin') || style.includes('spin') || style.includes('orthodox') || style.includes('break') || style.includes('googly') || style.includes('chinaman') || style.includes('wrist')) {
        return 'Spin';
    }
    if (role.includes('pace') || role.includes('fast') || role.includes('medium') || style.includes('pace') || style.includes('fast') || style.includes('medium') || style.includes('seam')) {
        return 'Pace';
    }
    return '';
};

export const getPlayerBattingStyle = (player) => {
    if (!player) return '';
    const raw = player.batting_style || player['batting style'] || player.Batting_Style || player['Batting Style'] || '';
    if (raw) {
        const lower = String(raw).toLowerCase().trim();
        if (lower.includes('left') || lower === 'lhb') return 'Left Handed';
        if (lower.includes('right') || lower === 'rhb') return 'Right Handed';
        return String(raw).trim();
    }
    const rawBowl = player.bowling_style || player['bowling style'] || player.Bowling_Style || player['Bowling Style'] || '';
    if (rawBowl) {
        const lower = String(rawBowl).toLowerCase().trim();
        if (lower.includes('left')) return 'Left Handed';
        if (lower.includes('right')) return 'Right Handed';
    }
    return '';
};

export const getPlayerBowlingStyle = (player) => {
    if (!player) return '';
    return player.bowling_style || player['bowling style'] || player.Bowling_Style || player['Bowling Style'] || '';
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

export const formatNative = (lakhs, sourceCurrency = 'inr') => {
    if (lakhs === undefined || lakhs === null || isNaN(lakhs)) {
        return sourceCurrency === 'zar' ? 'R0' : '₹0';
    }
    const num = Number(lakhs);

    if (sourceCurrency === 'zar') {
        const millions = num / 10;
        if (millions >= 1) {
            const formatted = millions % 1 === 0 ? millions.toFixed(0) : parseFloat(millions.toFixed(2));
            return `R${formatted}M`;
        } else {
            const k = Math.round(millions * 1000);
            return `R${k}K`;
        }
    }

    // Default INR
    const cr = num / 100;
    if (cr >= 1) {
        const formatted = (cr >= 100 && cr % 1 === 0) ? cr.toFixed(0) : cr.toFixed(2);
        return `₹${formatted} Cr`;
    } else {
        const formatted = num % 1 === 0 ? num.toFixed(0) : parseFloat(num.toFixed(1));
        return `₹${formatted}L`;
    }
};

/**
 * Format USD amount from internal stored Lakhs.
 * Uses exact benchmark conversion ($120K USD per 1 Cr INR, $54K USD per R1M ZAR).
 * No aggressive rounding to 10K so increments are exact:
 * - 200L INR (2 Cr)   -> $240K
 * - 225L INR (2.25 Cr) -> $270K
 * - 20L INR (0.2 Cr)  -> $24K
 * - 1000L INR (10 Cr) -> $1.2M
 * - 12000L INR (120 Cr) -> $14.4M
 */
export const formatUsd = (lakhs, sourceCurrency = 'inr') => {
    if (lakhs === undefined || lakhs === null || isNaN(lakhs) || Number(lakhs) === 0) {
        return '$0';
    }
    const num = Number(lakhs);
    const usdRatePerCr = CURRENCY_CONFIG[sourceCurrency]?.usdPerCr || 120000;
    const totalDollars = (num / 100) * usdRatePerCr;
    const millions = totalDollars / 1000000;

    if (millions >= 1) {
        const formatted = millions % 1 === 0 ? millions.toFixed(0) : parseFloat(millions.toFixed(2));
        return `$${formatted}M`;
    } else {
        const thousands = totalDollars / 1000;
        const formatted = thousands % 1 === 0 ? thousands.toFixed(0) : parseFloat(thousands.toFixed(1));
        return `$${formatted}K`;
    }
};

/**
 * fmtParts — returns separated currency components { primary, secondary, full }.
 *
 * When currency === 'usd':
 *   primary:   "$240K"
 *   secondary: "₹2.00 Cr"
 *   full:      "$240K (₹2.00 Cr)"
 *
 * When currency === 'inr':
 *   primary:   "₹2Cr" (or "₹2.25Cr")
 *   secondary: null
 *   full:      "₹2Cr"
 */
export const fmtParts = (lakhs, currency = 'inr', sourceCurrency = 'inr') => {
    if (lakhs === undefined || lakhs === null || isNaN(lakhs)) {
        if (currency === 'usd') {
            const sym = CURRENCY_CONFIG[sourceCurrency]?.symbol || '₹';
            return { primary: '$0', secondary: `${sym}0`, full: `$0 (${sym}0)` };
        }
        const sym = CURRENCY_CONFIG[currency]?.symbol || '₹';
        const unit = CURRENCY_CONFIG[currency]?.unit || 'Cr';
        return { primary: `${sym}0${unit}`, secondary: null, full: `${sym}0${unit}` };
    }

    const num = Number(lakhs);

    if (currency === 'usd') {
        const primary = formatUsd(num, sourceCurrency);
        const secondary = formatNative(num, sourceCurrency);
        return {
            primary,
            secondary,
            full: `${primary} (${secondary})`
        };
    }

    if (currency === 'zar') {
        const millions = num / 10;
        let primary;
        if (millions >= 1) {
            const formatted = millions % 1 === 0 ? millions.toFixed(0) : parseFloat(millions.toFixed(2));
            primary = `R${formatted}M`;
        } else {
            const k = Math.round(millions * 1000);
            primary = `R${k}K`;
        }
        return { primary, secondary: null, full: primary };
    }

    // Default INR:
    const cr = num / 100;
    let primary;
    if (cr >= 1) {
        const formatted = parseFloat(cr.toFixed(2));
        primary = `₹${formatted}Cr`;
    } else {
        const formatted = parseFloat(num.toFixed(1));
        primary = `₹${formatted}L`;
    }
    return { primary, secondary: null, full: primary };
};

/**
 * fmtCr — formats an internal Lakhs value to a display string.
 *
 * @param {number} lakhs   — internal stored amount in Lakhs of primary currency
 * @param {string} currency — 'inr' | 'zar' | 'usd' (defaults to 'inr')
 * @param {string} sourceCurrency — 'inr' | 'zar' (defaults to 'inr')
 *
 * Examples (USD with INR source):
 *   200L   → "$240K (₹2.00 Cr)"
 *   225L   → "$270K (₹2.25 Cr)"
 *   50L    → "$60K (₹50L)"
 *   12000L → "$14.4M (₹120.00 Cr)"
 *
 * Examples (INR):
 *   200L → "₹2Cr"
 *   225L → "₹2.25Cr"
 *   50L  → "₹50L"
 */
export const fmtCr = (lakhs, currency = 'inr', sourceCurrency = 'inr') => {
    return fmtParts(lakhs, currency, sourceCurrency).full;
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
        console.log("[CURRENCY] Initialized benchmark exchange rates: 1 Cr INR = $120,000 USD, 1 Cr ZAR = $540,000 USD.");
        ratesFetched = true;
    } catch (err) {
        console.warn("[CURRENCY] Failed to initialize exchange rates:", err.message);
    }
};
