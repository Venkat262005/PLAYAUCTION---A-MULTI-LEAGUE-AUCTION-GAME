/** Resolve franchise short code from name, logo path, or explicit shortName */
export const resolveTeamShort = (teamName, teamLogo, shortName) => {
  if (shortName) return shortName.toUpperCase();

  const fromLogo = (teamLogo || '').match(/\/([A-Za-z0-9]+)\.(png|svg|jpg)/i)?.[1]?.toUpperCase();
  if (fromLogo) return fromLogo;

  const key = (teamName || '').trim().toLowerCase();
  return TEAM_NAME_TO_SHORT[key] || null;
};

const TEAM_NAME_TO_SHORT = {
  'chennai super kings': 'CSK',
  'mumbai indians': 'MI',
  'kolkata knight riders': 'KKR',
  'royal challengers bengaluru': 'RCB',
  'royal challengers bangalore': 'RCB',
  'sunrisers hyderabad': 'SRH',
  'delhi capitals': 'DC',
  'punjab kings': 'PBKS',
  'gujarat titans': 'GT',
  'lucknow super giants': 'LSG',
  'rajasthan royals': 'RR',
  'deccan chargers': 'DCG',
  'kochi tuskers kerala': 'KTK',
  'pune warriors india': 'PWI',
  'rising pune supergiant': 'RPS',
  'rising pune supergiants': 'RPS',
  'gujarat lions': 'GL',
  // WPL
  'up warriorz': 'UPW',
  'gujarat giants': 'GG',
  // SA20
  'joburg super kings': 'JSK',
  'sunrisers eastern cape': 'SEC',
  'paarl royals': 'PR',
  'pretoria capitals': 'PC',
  'mi cape town': 'MICT',
  "durban's super giants": 'DSG',
  'durban super giants': 'DSG',
};

const TEAM_SLOGANS = {
  CSK: [
    'A new Super King joins the Yellow Army!',
    'The King has found his kingdom!',
    'Another warrior for the Super Kings!',
    'Whistle Podu! A new King arrives in Chennai!',
  ],
  MI: [
    'Welcome to the City of Champions!',
    'A new force joins the Mumbai Paltan!',
    'The Blue Empire grows stronger!',
    'Mumbai has secured another game changer!',
  ],
  KKR: [
    'A new Knight rides into Kolkata!',
    'Korbo, Lorbo, Jeetbo! Another Knight joins the battle!',
    'The Knight Army welcomes its newest warrior!',
    'The Purple Brigade has found its next champion!',
  ],
  RCB: [
    'A Royal Challenger enters the arena!',
    'Bold ambitions need bold players!',
    'Another Royal ready for Bengaluru!',
    'The Challenger Army gets stronger!',
  ],
  SRH: [
    'A new Sunriser lights up Hyderabad!',
    'The Orange Army welcomes its newest warrior!',
    'Orange Army Rise!',
    'Rising with the Sun, ready for glory!',
    'Another flame joins the Sunrisers!',
  ],
  DC: [
    'A new Capital asset has arrived!',
    'Delhi strengthens its pursuit of glory!',
    'The Capital gains another match winner!',
    'A new chapter begins in the Capital!',
  ],
  PBKS: [
    'A new King joins Punjab!',
    "The King's Army grows stronger!",
    'Punjab crowns another warrior!',
    'The throne welcomes its newest champion!',
  ],
  GT: [
    'A new Titan rises in Gujarat!',
    'The Titan Army grows stronger!',
    'Built for greatness, welcomed by Titans!',
    'Another giant joins the Titans!',
  ],
  LSG: [
    'A new Super Giant has arrived!',
    'Lucknow welcomes its newest Giant!',
    'The Giant Army adds another weapon!',
    'Ready to rise with the Super Giants!',
  ],
  RR: [
    'A Royal talent joins Rajasthan!',
    'The Royals have found their newest jewel!',
    'Another warrior enters the Royal court!',
    'A royal addition to the Pink Army!',
  ],
};

/** Legacy / defunct franchises — "{name} is a …" style */
const LEGACY_SLOGAN = {
  DCG: (name) => `${name} is a Charger!`,
  KTK: (name) => `${name} is a Tusker!`,
  PWI: (name) => `${name} is a Warrior!`,
  RPS: (name) => `${name} is a Supergiant!`,
  GL: (name) => `${name} is a Lion!`,
};

const FALLBACK_SLOGANS = [
  '{player} joins the squad!',
  'Welcome aboard, {player}!',
  '{player} — a new signing for the franchise!',
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Returns a sold-line slogan with player name woven in.
 * @param {string} teamShortOrName - short code, full team name, or logo path hint
 * @param {string} playerName
 * @param {string} [teamLogo]
 */
export const getTeamSoldSlogan = (teamShortOrName, playerName, teamLogo) => {
  const displayName = playerName || 'the player';
  const isShortCode = teamShortOrName && teamShortOrName.length <= 5 && !String(teamShortOrName).includes(' ');
  const short = isShortCode
    ? String(teamShortOrName).toUpperCase()
    : resolveTeamShort(teamShortOrName, teamLogo, null);

  if (short && LEGACY_SLOGAN[short]) {
    return LEGACY_SLOGAN[short](displayName);
  }

  const pool = (short && TEAM_SLOGANS[short]) || FALLBACK_SLOGANS;
  let line = pickRandom(pool);

  if (line.includes('{player}')) {
    return line.replace(/\{player\}/g, displayName);
  }

  // Append player name like the reference UI: "Orange Army Rise! Jacob Bethell!"
  const trimmed = line.replace(/[!?.]+$/, '');
  return `${trimmed}! ${displayName}!`;
};
