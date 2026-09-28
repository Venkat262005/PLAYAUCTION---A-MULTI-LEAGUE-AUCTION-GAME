const IPL_TEAM_LOGOS = {
    'chennai super kings': '/ipl_logos/CSK.png',
    'csk': '/ipl_logos/CSK.png',
    'mumbai indians': '/ipl_logos/MI.png',
    'mi': '/ipl_logos/MI.png',
    'royal challengers bengaluru': '/ipl_logos/RCB.png',
    'royal challengers bangalore': '/ipl_logos/RCB.png',
    'rcb': '/ipl_logos/RCB.png',
    'kolkata knight riders': '/ipl_logos/KKR.png',
    'kkr': '/ipl_logos/KKR.png',
    'sunrisers hyderabad': '/ipl_logos/SRH.png',
    'srh': '/ipl_logos/SRH.png',
    'delhi capitals': '/ipl_logos/DC.png',
    'delhi daredevils': '/ipl_logos/DC.png',
    'dc': '/ipl_logos/DC.png',
    'punjab kings': '/ipl_logos/PBKS.png',
    'kings xi punjab': '/ipl_logos/PBKS.png',
    'pbks': '/ipl_logos/PBKS.png',
    'rajasthan royals': '/ipl_logos/RR.png',
    'rr': '/ipl_logos/RR.png',
    'gujarat titans': '/ipl_logos/GT.png',
    'gt': '/ipl_logos/GT.png',
    'lucknow super giants': '/ipl_logos/LSG.png',
    'lsg': '/ipl_logos/LSG.png',
    'deccan chargers': '/ipl_logos/DCG.png',
    'dcg': '/ipl_logos/DCG.png',
    'kochi tuskers kerala': '/ipl_logos/KTK.png',
    'ktk': '/ipl_logos/KTK.png',
    'pune warriors india': '/ipl_logos/PWI.png',
    'pwi': '/ipl_logos/PWI.png',
    'rising pune supergiant': '/ipl_logos/RPS.png',
    'rps': '/ipl_logos/RPS.png',
    'gujarat lions': '/ipl_logos/GL.png',
    'gl': '/ipl_logos/GL.png'
};

const WPL_TEAM_LOGOS = {
    'mumbai indians': '/wpl_logos/MI.png',
    'mi': '/wpl_logos/MI.png',
    'delhi capitals': '/wpl_logos/DC.png',
    'dc': '/wpl_logos/DC.png',
    'royal challengers bangalore': '/wpl_logos/RCB.png',
    'royal challengers bengaluru': '/wpl_logos/RCB.png',
    'rcb': '/wpl_logos/RCB.png',
    'gujarat giants': '/wpl_logos/Gujarat_Giants_WPL_logo.svg.png',
    'gg': '/wpl_logos/Gujarat_Giants_WPL_logo.svg.png',
    'up warriorz': '/wpl_logos/UP_Warriors(z)_WPL_logo.png',
    'upw': '/wpl_logos/UP_Warriors(z)_WPL_logo.png'
};

const SA20_TEAM_LOGOS = {
    "durban's super giants": "/sa20_logos/Durban's_Super_Giants_Logo.png",
    'dsg': "/sa20_logos/Durban's_Super_Giants_Logo.png",
    'joburg super kings': '/sa20_logos/Joburg_Super_Kings_Logo.png',
    'jsk': '/sa20_logos/Joburg_Super_Kings_Logo.png',
    'mi cape town': '/sa20_logos/MI_Cape_Town_–_Logo.png',
    'mict': '/sa20_logos/MI_Cape_Town_–_Logo.png',
    'paarl royals': '/sa20_logos/Paarl_Royals_log0.png',
    'pr': '/sa20_logos/Paarl_Royals_log0.png',
    'pretoria capitals': '/sa20_logos/Pretoria_Capitals_logo.png',
    'pc': '/sa20_logos/Pretoria_Capitals_logo.png',
    'sunrisers eastern cape': '/sa20_logos/Sunrisers_Eastern_Cape_Logo.png',
    'sec': '/sa20_logos/Sunrisers_Eastern_Cape_Logo.png'
};

function getTeamLogoUrl(teamName = '', league = 'ipl', fallback = '') {
    if (!teamName) return fallback || '/ipl_logos/ipl-logo.png';
    const key = teamName.trim().toLowerCase();
    const l = (league || 'ipl').toLowerCase();

    if (l === 'wpl' && WPL_TEAM_LOGOS[key]) return WPL_TEAM_LOGOS[key];
    if (l === 'sa20' && SA20_TEAM_LOGOS[key]) return SA20_TEAM_LOGOS[key];
    if (IPL_TEAM_LOGOS[key]) return IPL_TEAM_LOGOS[key];

    const dict = l === 'wpl' ? WPL_TEAM_LOGOS : (l === 'sa20' ? SA20_TEAM_LOGOS : IPL_TEAM_LOGOS);
    for (const [name, path] of Object.entries(dict)) {
        if (key.includes(name) || name.includes(key)) return path;
    }

    return fallback || (l === 'wpl' ? '/wpl_logos/wpl logo.svg' : (l === 'sa20' ? '/sa20_logos/SA20Logo.png' : '/ipl_logos/ipl-logo.png'));
}

module.exports = {
    getTeamLogoUrl,
    IPL_TEAM_LOGOS,
    WPL_TEAM_LOGOS,
    SA20_TEAM_LOGOS
};
