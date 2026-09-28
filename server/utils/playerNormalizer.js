/**
 * playerNormalizer.js
 * Standardizes player objects from various MongoDB collections into a consistent schema.
 */

const { isUncappedPlayer } = require('../services/sa20History');

const parseStatNum = (val) => {
    if (val === undefined || val === null || String(val).trim() === '-') return 0;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
};

const parseStatStr = (val, fallback = '-') => {
    if (val === undefined || val === null || String(val).trim() === '-') return fallback;
    return String(val).trim();
};

const formatBattingPosition = (pos) => {
    if (!pos || String(pos).trim() === '-' || String(pos).trim() === '') return '';
    const clean = String(pos).trim().toLowerCase();
    if (clean.includes('top')) return 'Top Order';
    if (clean.includes('finish')) return 'Finisher';
    if (clean.includes('middle') && clean.includes('lower')) return 'Middle / Lower Order';
    if (clean.includes('middle')) return 'Middle Order';
    if (clean.includes('lower')) return 'Lower Order';
    return String(pos).trim().replace(/\b\w/g, l => l.toUpperCase());
};

const formatBowlingType = (type, role, bowlingStyle) => {
    if (type && String(type).trim() !== '' && String(type).trim() !== '-') {
        const c = String(type).trim().toLowerCase();
        if (c.includes('spin') || c.includes('leg') || c.includes('off') || c.includes('orthodox')) return 'Spin';
        if (c.includes('pace') || c.includes('fast') || c.includes('medium') || c.includes('seam')) return 'Pace';
        return String(type).trim().replace(/\b\w/g, l => l.toUpperCase());
    }
    const combined = `${role || ''} ${bowlingStyle || ''}`.toLowerCase();
    if (combined.includes('spin') || combined.includes('leg') || combined.includes('orthodox') || combined.includes('googly') || combined.includes('off break')) {
        return 'Spin';
    }
    if (combined.includes('pace') || combined.includes('fast') || combined.includes('medium') || combined.includes('seam')) {
        return 'Pace';
    }
    return '';
};

const formatBattingStyle = (style) => {
    if (!style || String(style).trim() === '-' || String(style).trim() === '') return '';
    const clean = String(style).trim().toLowerCase();
    if (clean.includes('left')) return 'Left Handed';
    if (clean.includes('right')) return 'Right Handed';
    return String(style).trim().replace(/\b\w/g, l => l.toUpperCase());
};

const getCollectionsForLeague = (league) => {
    const l = String(league).toLowerCase();
    if (l === 'sa20') {
        return [
            'MEGA',
            'ELITE',
            'DAIMOND',
            'GOLD',
            'SILVER',
            'DOMESTIC'
        ];
    }
    if (l === 'wpl') {
        return [
            'marquee',
            'batters',
            'wicketkeepers',
            'bowlers',
            'allrounders',
            'uncapped'
        ];
    }
    // Default to IPL collections
    return [
        'marquee_batters',
        'marquee_bowlers',
        'marquee_allrounders',
        'marquee_wicketkeepers',
        'pool1_batters',
        'pool1_bowlers',
        'pool1_allrounders',
        'pool1_wicketkeepers',
        'Emerging_players',
        'pool2_batters',
        'pool2_bowlers',
        'pool2_allrounders',
        'pool2_wicketkeepers',
        'pool3_batters',
        'pool3_allrounders'
    ];
};

const mapTeamTakenToFranchise = (teamTaken) => {
    if (!teamTaken) return null;
    const clean = String(teamTaken).toLowerCase().replace(/\s+/g, ' ').trim();
    if (clean.includes('durban')) return 'DSG';
    if (clean.includes('joburg')) return 'JSK';
    if (clean.includes('cape town') || clean.includes('mict')) return 'MICT';
    if (clean.includes('paarl')) return 'PR';
    if (clean.includes('pretoria')) return 'PC';
    if (clean.includes('eastern cape') || clean.includes('sec') || clean.includes('sunrisers')) return 'SEC';
    return null;
};

const normalizePlayer = (p, collName) => {
    const lowerColl = collName.toLowerCase();
    const isSa20 = ['mega', 'elite', 'daimond', 'gold', 'silver', 'domestic', 'presigned_players'].includes(lowerColl) || lowerColl.startsWith('set_');

    // 1. Determine Name
    const firstName = p["First Name"] || p.First_Name || p.firstName || "";
    const surname = p.Surname || p.surname || "";
    const fullName = (firstName + (firstName && surname ? " " : "") + surname).replace(/\s+/g, ' ').trim();
    const name = p.name || p.player || p.Player || fullName || 'Unknown Player';

    // 2. Determine Role
    let role = p.role || p.Role || p.Specialism || 'Batsman';
    const lowerRole = role.toLowerCase();
    const isBowlerPool = lowerColl.includes('bowler') || lowerColl.includes('bowl');
    const isAllrounderPool = lowerColl.includes('allrounder') || lowerColl.includes('all_rounder') || lowerColl.includes('all-rounder');

    if (lowerRole.includes('keeper') || lowerRole.includes('wk')) {
        role = 'Wicketkeeper';
    } else if (isAllrounderPool) {
        if (lowerRole.includes('pace') || lowerRole.includes('fast') || lowerRole.includes('medium') || String(p.bowling_style || p['bowling style'] || '').toLowerCase().includes('fast') || String(p.bowling_style || p['bowling style'] || '').toLowerCase().includes('pace')) {
            role = 'Pace Bowling Allrounder';
        } else if (lowerRole.includes('spin') || String(p.bowling_style || p['bowling style'] || '').toLowerCase().includes('spin')) {
            role = 'Spin Bowling Allrounder';
        } else {
            role = 'All-Rounder';
        }
    } else if (isBowlerPool) {
        if (lowerRole.includes('spin') || String(p.bowling_style || p['bowling style'] || '').toLowerCase().includes('spin')) {
            role = 'Spin Bowler';
        } else {
            role = 'Pace Bowler';
        }
    } else if (lowerRole.includes('spin') && (lowerRole.includes('all') || lowerRole.includes('ar') || lowerRole.includes('rounder'))) {
        role = 'Spin Bowling Allrounder';
    } else if ((lowerRole.includes('pace') || lowerRole.includes('fast') || lowerRole.includes('medium')) && (lowerRole.includes('all') || lowerRole.includes('ar') || lowerRole.includes('rounder'))) {
        role = 'Pace Bowling Allrounder';
    } else if (lowerRole.includes('all') || lowerRole.includes('ar') || lowerRole.includes('rounder')) {
        role = 'All-Rounder';
    } else if (lowerRole.includes('spin') && (lowerRole.includes('bowl') || lowerRole.includes('bw') || lowerRole.includes('spin'))) {
        role = 'Spin Bowler';
    } else if ((lowerRole.includes('fast') || lowerRole.includes('pace') || lowerRole.includes('medium')) && (lowerRole.includes('bowl') || lowerRole.includes('bw') || lowerRole.includes('fast') || lowerRole.includes('pace'))) {
        role = 'Pace Bowler';
    } else if (lowerRole.includes('bowl') || lowerRole.includes('spin') || lowerRole.includes('fast') || lowerRole.includes('pace')) {
        role = 'Bowler';
    } else {
        role = 'Batsman';
    }

    // 3. Determine Nationality
    const nationality = p.nationality || p.Country || p.country || '';
    const cleanNat = nationality.toLowerCase().trim();

    // 4. Determine Overseas
    let isOverseas = p.isOverseas;
    if (isOverseas === undefined) {
        if (isSa20) {
            isOverseas = cleanNat !== '' && !['rsa', 'south africa', 'sa'].includes(cleanNat);
        } else {
            isOverseas = cleanNat !== '' && !['india', 'ind'].includes(cleanNat);
        }
    }

    // 5. Determine Base Price (or signed price for presigned players)
    let bp = 50;
    if (isSa20) {
        if (lowerColl.includes('mega') || lowerColl.includes('elite')) bp = 7.5; // R750k
        else if (lowerColl.includes('daimond') || lowerColl.includes('gold')) bp = 5.0; // R500k
        else if (lowerColl.includes('silver') || lowerColl.includes('domestic')) bp = 1.0; // R100k
        else if (lowerColl.includes('wk1') || lowerColl.includes('ba1') || lowerColl.includes('ar1') || lowerColl.includes('fa1') || lowerColl.includes('sp1')) {
            bp = 7.5; // default for set 1 (R750,000)
        } else if (lowerColl.includes('wk2') || lowerColl.includes('ba2') || lowerColl.includes('ar2') || lowerColl.includes('fa2') || lowerColl.includes('sp2')) {
            bp = 5.0; // default for set 2 (R500,000)
        } else {
            bp = 1.0; // default for set 3/next (R100,000)
        }
    } else {
        const reservePriceVal = p["Base Price (ZAR)"] || p["Signed Price (ZAR)"] || p["Reserve Price (ZAR)"] || p.basePrice || p.base_price || p.Reserve_Price || p.ReservePrice;
        if (reservePriceVal !== undefined && reservePriceVal !== null) {
            const cleanPrice = String(reservePriceVal).replace(/,/g, '').trim();
            const parsedPrice = parseFloat(cleanPrice);
            if (!isNaN(parsedPrice)) {
                bp = parsedPrice > 10000 ? parsedPrice / 100000 : parsedPrice;
            }
        } else {
            if (lowerColl.startsWith('marquee')) bp = 200; // 2cr
            else if (lowerColl.includes('pool1')) bp = 150; // 1.5cr
            else if (lowerColl.includes('emerging')) bp = 30; // 30L
            else if (lowerColl.includes('pool2')) bp = 100; // 1cr
            else if (lowerColl.includes('pool3')) bp = 50; // 50L
            else if (lowerColl.includes('pool4')) bp = 50; // 50L
        }
    }

    const age = Number(p.Age || p.age || 0);
    const isU23 = !isSa20 && (
        p.isU23 === true || String(p.isU23).toLowerCase() === 'true' ||
        (age > 0 && age <= 23) ||
        lowerColl.includes('emerging') || lowerColl.includes('rookie')
    );
    const isUncapped = isSa20 && (lowerColl.includes('domestic') || isUncappedPlayer(name));

    let fallbackImg = '';
    if (p.Catches && typeof p.Catches === 'string' && (p.Catches.startsWith('http') || p.Catches.startsWith('data:'))) {
        fallbackImg = p.Catches;
    }
    const imgUrl = p.image_url || p.image_path || p.imagepath || p.image || fallbackImg || '';
    const cleanImgUrl = (/hscicdn\.com\/image\/upload\/f_auto\/?$/i.test(imgUrl) || imgUrl.length < 45) ? '' : imgUrl;

    const rawBattingPos = p.position || p['batting position'] || p.batting_position || p.battingPosition || '';
    const rawBattingStyle = p.batting_style || p['batting style'] || p.battingStyle || p['Batting style'] || p['Batting Style'] || '';
    const rawBowlingStyle = p.bowling_style || p['bowling style'] || p.bowlingStyle || p['Bowling style'] || p['Bowling Style'] || '';
    const rawBowlingType = p.bowling_type || p['bowling type'] || p.bowlingType || '';

    const battingPosition = formatBattingPosition(rawBattingPos);
    const bowlingType = formatBowlingType(rawBowlingType, role, rawBowlingStyle);
    const battingStyle = formatBattingStyle(rawBattingStyle);
    const bowlingStyle = rawBowlingStyle ? String(rawBowlingStyle).trim() : '';

    return {
        ...p,
        _id: String(p._id),
        name,
        role,
        nationality,
        isOverseas,
        poolName: collName.replace(/_/g, ' ').toUpperCase(),
        poolID: collName,
        basePrice: bp,
        imagepath: cleanImgUrl,
        image_path: cleanImgUrl,
        photoUrl: cleanImgUrl,
        image: cleanImgUrl || '/default-player.png',
        age: age > 0 ? age : undefined,
        isU23: !!isU23,
        isUncapped: isSa20 ? !!isUncapped : undefined,
        position: battingPosition || undefined,
        batting_position: battingPosition || undefined,
        bowling_type: bowlingType || undefined,
        batting_style: battingStyle || undefined,
        bowling_style: bowlingStyle || undefined,
        // Nest stats for UI and AI compatibility
        stats: {
            battingAvg: parseStatNum(p.batting_avg || p.battingAvg || p["Batting Avg"] || p.stats?.battingAvg),
            strikeRate: parseStatNum(p.batting_strike_rate || p.strike_rate || p.strikeRate || p["Strike rate"] || p.stats?.strikeRate),
            highestScore: parseStatNum(p.highest_score || p.highestScore || p.Hs || p.HS || p["Highest score"] || p.stats?.highestScore),
            bowlingAvg: parseStatNum(p.bowling_avg || p.bowlingAvg || p["Bowling avg"] || p.stats?.bowlingAvg),
            economy: parseStatNum(p.bowling_economy || p.economy || p["bowling economy"] || p.economyRate || p.stats?.economy),
            bestFigures: parseStatStr(p.best_bowling_figures || p.bestFigures || p.BF || p["Best Bowling Figures in innings"] || p.stats?.bestFigures, '0/0'),
            matches: parseStatNum(p.matches || p["matches played "] || p.matchesPlayed || p.stats?.matches),
            runs: parseStatNum(p.runs || p.Runs || p.stats?.runs),
            wickets: parseStatNum(p.wickets || p.Wickets || p.stats?.wickets),
            catches: parseStatNum(p.catches || p.Catches || p.catches || p.stats?.catches),
            stumpings: parseStatNum(p.stumpings || p.stumps || p.Stumps || p.Stumping || p.stats?.stumpings)
        }
    };
};

module.exports = {
    normalizePlayer,
    getCollectionsForLeague,
    mapTeamTakenToFranchise
};

