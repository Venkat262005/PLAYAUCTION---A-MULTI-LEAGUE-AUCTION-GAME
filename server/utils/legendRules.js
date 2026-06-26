const canon = (name) =>
    String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const IPL_LEGEND_NAMES = [
    "Virat Kohli", "MS Dhoni", "Rohit Sharma",
    "AB de Villiers", "Suresh Raina", "David Warner", "Chris Gayle",
    "Jasprit Bumrah", "Bhuvneshwar Kumar", "Lasith Malinga", "Yuzvendra Chahal",
    "Dale Steyn", "Hardik Pandya", "Ravindra Jadeja", "Kieron Pollard",
    "Andre Russell", "Dwayne Bravo", "Sachin Tendulkar", "Virender Sehwag",
];

const SA20_LEGEND_KEYS = new Set([
    'fafduplessis',
    'davidmiller',
    'heinrichklaasen',
    'heinrichklassen',
    'quintondekock',
    'kagisorabada',
    'aidenmarkram',
    'willjacks',
]);

const isLegendPlayer = (playerName, league) => {
    if (!playerName) return false;
    const lg = String(league || 'ipl').toLowerCase();
    if (lg === 'wpl') return false;
    if (lg === 'sa20') return SA20_LEGEND_KEYS.has(canon(playerName));
    return IPL_LEGEND_NAMES.includes(playerName);
};

const getLegendNamesForLeague = (league) => {
    const lg = String(league || 'ipl').toLowerCase();
    if (lg === 'sa20') return [...SA20_LEGEND_KEYS];
    if (lg === 'ipl') return IPL_LEGEND_NAMES;
    return [];
};

module.exports = { isLegendPlayer, getLegendNamesForLeague, IPL_LEGEND_NAMES };
