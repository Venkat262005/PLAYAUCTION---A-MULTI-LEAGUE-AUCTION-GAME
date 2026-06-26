const canon = (name) =>
    String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export const IPL_LEGEND_METADATA = {
    "Virat Kohli": { title: "THE KING", subtitle: "Modern Day Legend", color: "from-red-600 via-yellow-500 to-red-600", aura: "rgba(255, 61, 61, 0.4)", accent: "#FFD700" },
    "MS Dhoni": { title: "THALA", subtitle: "The Captain Cool", color: "from-yellow-400 via-blue-800 to-yellow-400", aura: "rgba(255, 215, 0, 0.4)", accent: "#FFD700" },
    "Rohit Sharma": { title: "THE HITMAN", subtitle: "Captain of Champions", color: "from-blue-600 via-white to-blue-600", aura: "rgba(0, 75, 160, 0.4)", accent: "#FFFFFF" },
    "AB de Villiers": { title: "MR. 360", subtitle: "Genius of Modern Cricket", color: "from-red-600 via-black to-red-600", aura: "rgba(239, 68, 68, 0.4)", accent: "#FFD700" },
    "Suresh Raina": { title: "MR. IPL", subtitle: "The Heart of CSK", color: "from-yellow-400 via-yellow-600 to-yellow-400", aura: "rgba(234, 179, 8, 0.4)", accent: "#FFD700" },
    "David Warner": { title: "THE WARRIOR", subtitle: "Bull from the Bullring", color: "from-orange-500 via-black to-orange-600", aura: "rgba(249, 115, 22, 0.4)", accent: "#FFA500" },
    "Chris Gayle": { title: "UNIVERSE BOSS", subtitle: "King of the T20 Format", color: "from-red-700 via-yellow-500 to-red-700", aura: "rgba(185, 28, 28, 0.4)", accent: "#FFD700" },
    "Jasprit Bumrah": { title: "BOOM BOOM", subtitle: "The Greatest in the World", color: "from-blue-700 via-yellow-400 to-blue-700", aura: "rgba(29, 78, 216, 0.4)", accent: "#60A5FA" },
    "Bhuvneshwar Kumar": { title: "SWING KING", subtitle: "The Artist of Swing", color: "from-orange-400 via-blue-900 to-orange-400", aura: "rgba(251, 146, 60, 0.4)", accent: "#FDBA74" },
    "Lasith Malinga": { title: "THE SLINGER", subtitle: "God of Death Overs", color: "from-blue-600 via-yellow-500 to-blue-600", aura: "rgba(37, 99, 235, 0.4)", accent: "#EAB308" },
    "Yuzvendra Chahal": { title: "YUZI", subtitle: "The Smart Spinner", color: "from-pink-500 via-blue-600 to-pink-500", aura: "rgba(236, 72, 153, 0.4)", accent: "#F472B6" },
    "Dale Steyn": { title: "STEYN GUN", subtitle: "Precision in Pace", color: "from-red-600 via-gray-800 to-red-600", aura: "rgba(220, 38, 38, 0.4)", accent: "#9CA3AF" },
    "Hardik Pandya": { title: "KUNG FU PANDYA", subtitle: "The Ultimate All-Rounder", color: "from-blue-900 via-yellow-500 to-blue-900", aura: "rgba(30, 58, 138, 0.4)", accent: "#EAB308" },
    "Ravindra Jadeja": { title: "SIR JADEJA", subtitle: "The Dynamic 3-D Legend", color: "from-yellow-400 via-green-800 to-yellow-400", aura: "rgba(234, 179, 8, 0.4)", accent: "#FFD700" },
    "Kieron Pollard": { title: "POLLY", subtitle: "The Powerful Finisher", color: "from-blue-800 via-yellow-600 to-blue-800", aura: "rgba(30, 64, 175, 0.4)", accent: "#FFD700" },
    "Andre Russell": { title: "DRE RUSS", subtitle: "Muscle of Muscle", color: "from-purple-700 via-yellow-500 to-purple-700", aura: "rgba(126, 34, 206, 0.4)", accent: "#EAB308" },
    "Dwayne Bravo": { title: "CHAMPION", subtitle: "The Showman", color: "from-yellow-400 via-blue-700 to-yellow-400", aura: "rgba(234, 179, 8, 0.4)", accent: "#FFD700" },
    "Sachin Tendulkar": { title: "GOD OF CRICKET", subtitle: "The Ultimate Legend", color: "from-blue-600 via-orange-500 to-blue-600", aura: "rgba(37, 99, 235, 0.4)", accent: "#FFD700" },
    "Virender Sehwag": { title: "NAWAB", subtitle: "The Sultan of Multan", color: "from-orange-500 via-red-700 to-orange-500", aura: "rgba(234, 88, 12, 0.4)", accent: "#FFD700" },
};

const SA20_LEGEND_ENTRIES = [
    { keys: ['fafduplessis'], meta: { title: "THE GENERAL", subtitle: "SA20 Icon · Faf du Plessis", color: "from-amber-500 via-red-700 to-amber-500", aura: "rgba(245, 158, 11, 0.35)", accent: "#F59E0B" } },
    { keys: ['davidmiller'], meta: { title: "KILLER MILLER", subtitle: "SA20 Finisher Legend", color: "from-pink-600 via-purple-900 to-pink-600", aura: "rgba(219, 39, 119, 0.35)", accent: "#F472B6" } },
    { keys: ['heinrichklaasen', 'heinrichklassen'], meta: { title: "KLASS ACT", subtitle: "Power-Hitting Maestro", color: "from-teal-500 via-blue-900 to-teal-500", aura: "rgba(20, 184, 166, 0.35)", accent: "#2DD4BF" } },
    { keys: ['quintondekock'], meta: { title: "QDK", subtitle: "Left-Hand Lightning", color: "from-green-600 via-yellow-500 to-green-600", aura: "rgba(34, 197, 94, 0.35)", accent: "#FFD700" } },
    { keys: ['kagisorabada'], meta: { title: "KG", subtitle: "Pace Predator", color: "from-green-700 via-lime-400 to-green-700", aura: "rgba(22, 163, 74, 0.35)", accent: "#A3E635" } },
    { keys: ['aidenmarkram'], meta: { title: "MARKRAM", subtitle: "Elegant Champion", color: "from-blue-700 via-orange-500 to-blue-700", aura: "rgba(29, 78, 216, 0.35)", accent: "#FB923C" } },
    { keys: ['willjacks'], meta: { title: "WILL POWER", subtitle: "Dynamic All-Round Star", color: "from-indigo-600 via-cyan-400 to-indigo-600", aura: "rgba(79, 70, 229, 0.35)", accent: "#22D3EE" } },
];

export const getLegendMetadata = (playerName, league) => {
    if (!playerName) return null;
    const lg = String(league || 'ipl').toLowerCase();

    if (lg === 'sa20') {
        const key = canon(playerName);
        const entry = SA20_LEGEND_ENTRIES.find((e) => e.keys.includes(key));
        return entry ? { ...entry.meta, name: playerName } : null;
    }

    if (lg === 'ipl') {
        const meta = IPL_LEGEND_METADATA[playerName];
        return meta ? { ...meta, name: playerName } : null;
    }

    return null;
};

export const isLegendPlayer = (playerName, league) => !!getLegendMetadata(playerName, league);

/** @deprecated use getLegendMetadata — kept for any legacy imports */
export const LEGEND_METADATA = IPL_LEGEND_METADATA;
