const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { z } = require("zod");
const Groq = require("groq-sdk");
const PlayerCache = require("../utils/PlayerCache");

function getGeminiApiKey() {
    return process.env.GOOGLE_API_KEY
        || process.env.GOOGLE_GEMINI_API_KEY
        || process.env.GEMINI_API_KEY;
}

function getGeminiModelName() {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

const buyDetailSchema = z.union([
    z.string(),
    z.object({
        player: z.string().optional(),
        name: z.string().optional(),
        price: z.union([z.string(), z.number()]).optional(),
        rationale: z.string().optional(),
        analysis: z.string().optional(),
        reason: z.string().optional()
    })
]);

const benchReplacementSchema = z.object({
    primary_player: z.string(),
    backup_player: z.string(),
    role: z.string().optional(),
    coverage_quality: z.string().optional(),
    tactical_impact: z.string().optional()
});

const phaseRatingDetailSchema = z.object({
    score: z.number().min(0).max(10),
    analysis: z.string().optional()
});

const phaseRatingsSchema = z.object({
    powerplay: phaseRatingDetailSchema.optional(),
    middle_overs: phaseRatingDetailSchema.optional(),
    death_overs: phaseRatingDetailSchema.optional()
}).optional();

const tournamentProjectionSchema = z.object({
    projected_finish: z.string().optional(),
    playoff_probability: z.string().optional(),
    title_odds: z.string().optional()
}).optional();

const pitchSuitabilitySchema = z.object({
    home_ground: z.string().optional(),
    suitability_score: z.number().optional(),
    verdict: z.string().optional()
}).optional();

const squadMetricsSchema = z.object({
    balance_score: z.number().optional(),
    star_power_score: z.number().optional(),
    bench_depth_score: z.number().optional()
}).optional();

const teamResultSchema = z.object({
    teamId: z.string(),
    teamName: z.string().optional(),
    response: z.object({
        rating: z.number().int().min(0).max(100),
        auction_grade: z.string(),
        playing_xi: z.array(z.object({ name: z.string(), role: z.string() })),
        substitutes: z.array(z.object({ name: z.string(), reason: z.string() })),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        key_players: z.array(z.string()),
        best_buy: buyDetailSchema,
        steal_of_auction: buyDetailSchema,
        worst_buy: buyDetailSchema,
        overpaid_players: z.array(buyDetailSchema),
        missing_roles: z.array(z.string()),
        bench_like_for_like_replacements: z.array(benchReplacementSchema).optional(),
        phase_ratings: phaseRatingsSchema,
        pitch_suitability: pitchSuitabilitySchema,
        tournament_projection: tournamentProjectionSchema,
        squad_metrics: squadMetricsSchema,
        overall_analysis: z.string(),
        batting_analysis: z.string(),
        bowling_analysis: z.string(),
        auction_analysis: z.string(),
        home_pitch_analysis: z.string(),
        championship_prediction: z.string(),
        summary: z.string()
    })
});

function safeParseJson(text) {
    if (!text || typeof text !== 'string') throw new Error('EMPTY_GEMINI_RESPONSE');
    const cleaned = text.trim();
    const fencedMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
        return JSON.parse(fencedMatch[1].trim());
    }

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('INVALID_GEMINI_JSON');
    }
    const jsonText = cleaned.slice(start, end + 1);
    return JSON.parse(jsonText);
}

function buildPrompt(teamData) {
    const league = String(teamData.league || "IPL").toUpperCase();
    
    // Choose league-specific details
    let leagueRulesText = "";
    if (league === "SA20") {
        leagueRulesText = `
SA20 RULES
----------
- Minimum Squad Size: 17 Players (Deduct 10 points if squad size is less than 17)
- Minimum Wicketkeepers: 1 (Deduct 10 points if 0)
- Minimum Specialist Bowlers: 4 (Deduct 10 points if less than 4)
- Minimum Uncapped (Domestic) Players in SQUAD: 2 (Deduct 10 points if less than 2)
- Playing XI:
  * Exactly 11 players
  * Maximum 4 Overseas players (Deduct 10 points if more than 4 overseas)
`;
    } else if (league === "WPL") {
        leagueRulesText = `
WPL RULES
---------
- Minimum Squad Size: 15 Players (Deduct 10 points if squad size is less than 15)
- Minimum Wicketkeepers: 1 (Deduct 10 points if 0)
- Minimum Specialist Bowlers: 3 (Deduct 10 points if less than 3)
- Playing XI:
  * Exactly 11 players
  * Maximum 4 Overseas players (Deduct 10 points if more than 4 overseas)
`;
    } else {
        // Default to IPL
        leagueRulesText = `
IPL RULES
---------
- Minimum Squad Size: 18 Players (Official BCCI requirement. Deduct 15 points if squad size is less than 18)
- Minimum Wicketkeepers: 2 (Deduct 10 points if less than 2; having only 1 wicketkeeper leaves zero injury backup)
- Minimum Specialist Bowlers: 5 (Deduct 10 points if less than 5)
- Maximum Overseas Players in Squad: 8 (Deduct 10 points if more than 8 overseas)
- Playing XI:
  * Exactly 11 players
  * Maximum 4 Overseas players (Deduct 10 points if more than 4 overseas)
`;
    }

    const squadInfo = JSON.stringify({
        teamId: teamData.teamId || teamData.id || teamData.teamName,
        teamName: teamData.teamName || teamData.name,
        league: league,
        home_pitch: teamData.home_pitch || "Flat",
        budget: teamData.budget || {},
        squad: (teamData.playersAcquired || []).map(p => {
            const cached = (p._id || p.player || p.name) ? (PlayerCache.getPlayer(p.player || p._id) || PlayerCache.getPlayer(p.name)) : null;
            const rawRole = (p.role || cached?.role || '').toLowerCase();
            const battingPos = p.position || p.batting_position || p['batting position'] || p.battingPosition || cached?.position || cached?.batting_position || '';
            let bowlingType = p.bowling_type || p['bowling type'] || p.bowlingType || cached?.bowling_type || '';
            const battingStyle = p.batting_style || p['batting style'] || p.battingStyle || cached?.batting_style || '';
            const bowlingStyle = p.bowling_style || p['bowling style'] || p.bowlingStyle || cached?.bowling_style || '';

            if (!bowlingType) {
                const combined = `${p.role || cached?.role || ''} ${bowlingStyle}`.toLowerCase();
                if (combined.includes('spin') || combined.includes('leg') || combined.includes('off break') || combined.includes('orthodox')) {
                    bowlingType = 'Spin';
                } else if (combined.includes('pace') || combined.includes('fast') || combined.includes('medium') || combined.includes('seam')) {
                    bowlingType = 'Pace';
                }
            }

            return {
                name: p.name || p.player || cached?.name,
                role: p.role || cached?.role,
                batting_position: battingPos || undefined,
                bowling_type: bowlingType || undefined,
                batting_style: battingStyle || undefined,
                bowling_style: bowlingStyle || undefined,
                isOverseas: !!(p.isOverseas ?? cached?.isOverseas),
                isUncapped: !!(p.isUncapped ?? cached?.isUncapped),
                price: p.points || p.boughtFor || 0
            };
        })
    }, null, 2);

    let customLineupDirective = "";
    if (teamData.isCustomLineup && Array.isArray(teamData.customPlayingXI) && teamData.customPlayingXI.length === 11) {
        customLineupDirective = `
==================================================
CRITICAL USER-DEFINED CUSTOM LINEUP DIRECTIVE
==================================================
The human team manager has CHALLENGED the previous verdict and EXPLICITLY selected their own custom 11 Starters and Bench Reserves:

• USER-SELECTED STARTING 11 (MUST BE USED AS YOUR PLAYING XI):
${teamData.customPlayingXI.map((name, i) => `${i + 1}. ${name}`).join('\n')}

• USER-SELECTED BENCH RESERVES (MAX 8):
${(teamData.customBenchReserves || []).map((name, i) => `Reserve ${i + 1}: ${name}`).join('\n') || 'None specified'}

INSTRUCTIONS FOR CUSTOM EVALUATION:
1. In your output JSON 'playing_xi', you MUST include EXACTLY these 11 players selected by the user. Assign their tactical roles (Captain, Wicketkeeper, Batter, Bowler, All-Rounder) and optimal batting order.
2. In your output JSON 'substitutes', prioritize the user's selected Bench Reserves.
3. Critically score (0-100) and review the squad BASED ON THIS SPECIFIC PLAYING XI & BENCH COMBO.
4. In your summary and narrative, directly evaluate the user's custom selection:
   - Did the user make a tactical upgrade over standard lineups, or did they introduce new vulnerabilities?
   - How does this specific starting 11 perform in Powerplay, Middle, and Death overs?
   - Did the user leave key match-winners stranded on the bench or pick an unbalanced lineup?
`;
    }

    return `
You are an elite ${league} auction analyst, chief scout, franchise strategist, and live TV cricket pundit.
${customLineupDirective}

PERSONALITY & EVALUATION PHILOSOPHY
- ULTRA-CRITICAL, STRINGENT, AND UNCOMPROMISING. Do NOT be polite or generous. Most squads assembled in an auction have glaring structural holes—expose them mercilessly!
- Brutally honest and savage. Speak like an uncompromising live TV cricket pundit (e.g. Simon Doull or Nasser Hussain) famous for delivering ruthless, entertaining reality checks on poor auction strategies.
- ZERO RATING INFLATION. Avoid generic cluster scores (like giving everyone 78-83). Use the full 0-100 spectrum with aggressive discrimination based on real-world squad depth and tactical balance.
- Roast terrible auction decisions mercilessly (e.g. blowing budget on top-order anchor hoarders while playing tailenders at No. 7, having only 1 wicketkeeper, having zero death-overs executioners, or leaving the bench completely empty).
- If a squad fails roster minimums (e.g. less than 18 players in IPL), treat them as severely handicapped and deduct heavily.

ASSUMPTIONS
- Assume EVERY player is in their PRIME peak ability.
- Ignore age, injuries, retirement, and temporary form slumps.
- Judge strictly on peak cricketing ability, role balance, tactical synergy, and squad depth.
- Analyze the COMPLETE squad (all 18+ players), not just the Playing XI. A weak bench will cripple a team in a grueling 2-month tournament.

==================================================
LEAGUE-SPECIFIC VALIDATION RULES
==================================================

Apply ONLY these rules:
${leagueRulesText}

==================================================
THE GOLDEN EVALUATION PRINCIPLE: TEAM BALANCE FIRST
==================================================

CRITICAL UNIVERSAL SCORING MANDATE:
CUT POINTS ONLY IF AN AUCTION DECISION, FLAW, OR EXPENSIVE PURCHASE ACTUALLY DAMAGES OR COMPROMISES THE OVERALL TEAM BALANCE!
- If an unconventional selection, high-priced purchase, or minor imbalance does NOT actively harm the team's competitiveness, phase coverage, or starting XI strength, DO NOT CUT ANY POINTS!
- Every single point deduction MUST be justified by demonstrable, real-world damage to the squad's tactical balance.

==================================================
STRICT SCORING SYSTEM (Max 100 points)
==================================================

Evaluate the squad strictly out of 100 points based on the following breakdown. Apply deductions ONLY when the flaw actively impairs team balance:

1. Batting Positional Balance & Depth (Max 25 points):
   - The squad MUST have balanced, well-defined representation across key batting phases:
     * TOP ORDER: High-intent openers and No. 3 anchors who maximize powerplay fielding restrictions.
     * MIDDLE ORDER: Spin-destructors and stabilizers (No. 4-5) who prevent collapses and score freely through overs 7-15.
     * FINISHER: Genuine death-overs power hitters (No. 6-7) with 150+ career strike rates capable of boundary-hitting from ball one.
     * LOWER ORDER: Functional lower-order / tail-end batting depth (No. 8-11) who can score crucial cameos.
   - BATTING STYLE: Check for genuine Left-Hand / Right-Hand balance to break bowler lines and boundary dimensions.
   - DEDUCT POINTS (4 to 8 points) ONLY IF IT DAMAGES TEAM BALANCE:
     * Deduct ONLY IF a team is packed with top-order anchors AND has no genuine finishers, leaving them crippled at the death.
     * Deduct ONLY IF a long tail (starting at No. 7) leaves the team fragile to collapses.
     * If all-right-handers or an unconventional order still has elite strike rotation, power, and covers all phases smoothly: DO NOT DEDUCT!

2. Bowling Quality, Variety & Phase Coverage (Max 25 points):
   - The attack MUST feature true balance between EXPRESS PACE and WICKET-TAKING SPIN:
     * POWERPLAY (Overs 1-6): Swing quicks with new-ball penetration.
     * MIDDLE OVERS (Overs 7-15): Attacking wrist-spinners (leg spin/googly) and disciplined finger-spinners (off spin/left-arm orthodox) to break partnerships.
     * DEATH OVERS (Overs 16-20): Specialist death bowlers with yorkers, wide cutters, and change of pace.
   - DEDUCT POINTS (4 to 8 points) ONLY IF IT DAMAGES TEAM BALANCE:
     * Deduct ONLY IF the attack has no death-overs specialist and will reliably hemorrhage 15+ runs an over at the death.
     * Deduct ONLY IF the lack of spin or pace variety directly creates an exploitable tactical weakness.

3. All-Rounder Evaluation & Squad Flexibility (Max 20 points):
   - For ALL-ROUNDERS: Scrutinize BOTH their BATTING POSITION (middle order vs finisher) AND their BOWLING TYPE (pace vs spin).
   - Deduct ONLY IF an all-rounder purchase actively distorted the starting XI or added dead weight without bowling or batting utility.

4. Auction Strategy, Budget & Resource Allocation (Max 15 points):
   - BUDGET CONSTRAINT & ROLE SPENDING RULE:
     * Deduct EXACTLY -5 points for spending too much on a single marquee player OR spending recklessly on duplicate similar roles ONLY IF that purchase directly damaged or altered the overall team balance (e.g. left other critical departments starved or forced weak replacements).
     * If a team spent heavily on a superstar but STILL successfully built a balanced, lethal starting XI and solid roster around them: DO NOT DEDUCT ANY POINTS!
     * Deduct -5 points for expensive overseas benchwarmers ONLY IF it forced the team to field substandard local domestic players in the starting XI.

5. Bench Strength & Roster Depth (Max 15 points):
   - Deduct (3 to 6 points) ONLY IF an injury to 1 primary player would completely collapse the squad's balance (e.g. having zero backup for a solitary wicketkeeper or sole frontline spinner).

MANDATORY ROSTER PENALTIES (DEDUCT FROM FINAL TOTAL):
- If IPL squad size is less than 18: Deduct EXACTLY 15 points! (An IPL squad with <18 players is incomplete and cannot be rated above 65).
- If Wicketkeepers < 2: Deduct EXACTLY 10 points! (Having 1 keeper means zero backup in case of injury).
- If Specialist Bowlers < 5: Deduct EXACTLY 10 points!
- If Overseas in Squad > 8: Deduct EXACTLY 10 points!
- If Playing XI has more than 4 Overseas: Deduct EXACTLY 10 points!

CALIBRATED RATING SCALE:
- 90-100 = Historic, once-in-a-decade auction masterclass (near-impossible; requires 18+ prime players, perfect LHB/RHB balance, 2 world-class keepers, express pace, mystery/wrist spin, multiple 150+ SR finishers, and zero structural holes).
- 80-89 = Outstanding Championship Contender with elite depth and variety.
- 68-79 = Decent / Passable Squad. Visible tactical compromises, missing depth, or relying on out-of-position players.
- 52-67 = Severely Deficient / High-Risk Squad. Flawed auction with major holes (e.g. fewer than 18 players, only 1 keeper, no death-overs bowling, no finisher, or excessive top-order anchor stacking).
- Below 52 = Complete Auction Disasterclass.
==================================================

Evaluate the ENTIRE squad.

Analyze:

• Batting Order Structure:
  - Top Order coverage & openers
  - Middle Order stability
  - Finishers / death-over power hitters
  - Lower Order batting depth
  - Left-hand / Right-hand batting style balance
• Bowling Attack Structure:
  - Pace attack (powerplay swing & death yorkers)
  - Spin attack (middle overs control & wicket-taking)
  - Pace vs Spin balance
• All-rounders (evaluating BOTH their batting position and bowling type)
• Wicketkeepers
• Bench strength
• Domestic/Local core
• Overseas core
• Captaincy options
• Leadership
• Squad flexibility

==================================================
MATCH PHASE ANALYSIS (0-10 RATINGS & TACTICAL ANALYSIS)
==================================================

Analyze separately:

Batting & Bowling across all 3 key phases:
- Powerplay (Overs 1-6): Top order execution & pace swing breakthroughs.
- Middle Overs (Overs 7-15): Spin choke, middle order strokeplay vs spin, wicket-taking ability.
- Death Overs (Overs 16-20): Specialist finishers & yorker/cutter death-overs bowling execution.

Assign a strict 0-10 score and tactical note for each phase.

==================================================
AUCTION VALUATION METRICS (MANDATORY)
==================================================

Identify:
• Best Buy (best_buy): The marquee tactical cornerstone who anchors the team's balance. Specify player name, bought price, and tactical rationale.
• Steal of the Auction (steal_of_auction): Best value-for-money purchase who significantly outperforms their price tag. Specify player name, bought price, and tactical rationale.
• Worst Buy / Overpriced Buy (worst_buy): Most overpaid, questionable, or balance-damaging purchase. Specify player name, bought price, and explain how it distorted the auction or squad balance.
• Overpaid Players (overpaid_players): Array of players whose price exceeded their realistic utility.
• Missing Roles / Tactical Voids (missing_roles): Array of unfilled tactical gaps (e.g. lack of express 145kph pace, no domestic finisher, absence of backup keeper, long tail).

==================================================
BENCH STRENGTH & LIKE-FOR-LIKE REPLACEMENTS (MANDATORY METRIC)
==================================================

A grueling 2-month tournament tests squad durability. Evaluate whether the bench provides true like-for-like covers or if the squad is brittle:
Provide 3 to 5 realistic like-for-like comparisons:
- primary_player: The starter in the Playing XI
- backup_player: The bench player who replaces them if injured
- role: Specific tactical role (e.g. Top Order Anchor, Express Pace & Death Specialist, Wicketkeeper-Finisher, Mystery/Wrist Spinner)
- coverage_quality: Exactly one of "Elite" (near-zero drop-off), "Adequate" (decent cover, minor tactical compromise), or "Vulnerable" (huge drop-off, injury compromises team balance)
- tactical_impact: Specific tactical breakdown of how the team copes when the backup enters the starting XI.

==================================================
PITCH SUITABILITY & CONDITIONS ADAPTABILITY
==================================================

Analyze whether the squad suits its home stadium (${teamData.home_pitch || "Flat"} track) and give a 0-10 suitability score with detailed commentary.

==================================================
TOURNAMENT PROJECTION
==================================================

- projected_finish: "Champions / Finalists" | "Playoffs Contender (Top 4)" | "Mid-Table (5th-7th)" | "Wooden Spoon Risk"
- playoff_probability: e.g. "85%", "65%", "40%", "15%"
- title_odds: TV pundit verdict on championship odds.

==================================================
SQUAD COHESION METRICS (0-100)
==================================================
- balance_score: (0-100) Structural completeness and phase coverage.
- star_power_score: (0-100) Concentration of elite peak match-winners.
- bench_depth_score: (0-100) Roster resilience and like-for-like coverage.

==================================================
PLAYING XI
==================================================

Select the BEST Playing XI.

Rules:
- Exactly 11 players.
- Maximum 4 overseas players.
- Balanced batting and bowling.
- Mention Captain.
- Mention Wicketkeeper.

Also choose exactly 4 substitutes/impact players.

==================================================
FULL-FLEDGED BROAD SQUAD SUMMARY REQUIREMENTS (MANDATORY)
==================================================

DO NOT WRITE A SIMPLE ONE-LINER OR A GENERIC TWO-SENTENCE SUMMARY!
The "summary" field MUST be a BROAD, FULL-FLEDGED, MULTI-PARAGRAPH SCOUT REPORT (350–500 words).
Structure the summary into 4 distinct, cohesive narrative sections:

1. Squad Identity & Batting Blueprint:
   - Provide an eagle-eye view of the starting lineup and batting hierarchy.
   - Analyze the transition from top-order openers and anchors to middle-overs spin-hitters, designated finishers, and lower-order boundary potential. LHB/RHB tactical balance.

2. Bowling Dynamics & 20-Over Phase Strategy:
   - Exhaustive tactical review of the bowling attack.
   - Powerplay new-ball swing threats, middle-overs spin choke / wicket-taking options, and specialist death executioners (yorkers, wide cutters).

3. Bench Strength & Like-for-Like Resilience:
   - Stress-test the squad against injuries: do key match-winners have direct, high-quality like-for-like covers on the bench, or does the entire system collapse if 1 or 2 stars are sidelined?
   - Evaluate domestic core quality and overseas reserve flexibility.

4. Tournament Verdict & TV Pundit Reality Check:
   - Home ground adaptability and overall tournament trajectory.
   - Brutally honest TV-pundit prediction: title odds, playoff probability, and a memorable concluding roast or tribute.
- Mention at least 8–12 relevant player names naturally.
- End with a memorable TV-style punchline.

Do NOT repeat points or write generic statements.

==================================================
INPUT SQUAD
==================================================
${squadInfo}

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.
Do NOT use markdown.
Do NOT include explanations outside the JSON.

Use EXACTLY this schema:

{
  "teamId": "string",
  "teamName": "string",
  "response": {
    "rating": 0,
    "auction_grade": "A+|A|B+|B|C|D",
    "playing_xi": [
      {
        "name": "",
        "role": "Captain/Wicketkeeper/Batter/Bowler/All-Rounder"
      }
    ],
    "substitutes": [
      {
        "name": "",
        "reason": ""
      }
    ],
    "strengths": [
      "",
      "",
      "",
      "",
      ""
    ],
    "weaknesses": [
      "",
      "",
      "",
      "",
      ""
    ],
    "key_players": [
      "",
      "",
      ""
    ],
    "best_buy": {
      "player": "",
      "price": "",
      "rationale": ""
    },
    "steal_of_auction": {
      "player": "",
      "price": "",
      "rationale": ""
    },
    "worst_buy": {
      "player": "",
      "price": "",
      "rationale": ""
    },
    "overpaid_players": [
      {
        "player": "",
        "price": "",
        "rationale": ""
      }
    ],
    "missing_roles": [
      ""
    ],
    "bench_like_for_like_replacements": [
      {
        "primary_player": "Starter Name",
        "backup_player": "Bench Cover Name",
        "role": "Tactical Role",
        "coverage_quality": "Elite|Adequate|Vulnerable",
        "tactical_impact": "How team copes if starter is out"
      }
    ],
    "phase_ratings": {
      "powerplay": {
        "score": 8,
        "analysis": ""
      },
      "middle_overs": {
        "score": 8,
        "analysis": ""
      },
      "death_overs": {
        "score": 8,
        "analysis": ""
      }
    },
    "pitch_suitability": {
      "home_ground": "",
      "suitability_score": 8,
      "verdict": ""
    },
    "tournament_projection": {
      "projected_finish": "Champions / Finalists | Playoffs Contender | Mid-Table (5th-7th) | Wooden Spoon Risk",
      "playoff_probability": "0-100%",
      "title_odds": ""
    },
    "squad_metrics": {
      "balance_score": 80,
      "star_power_score": 85,
      "bench_depth_score": 75
    },
    "overall_analysis": "",
    "batting_analysis": "",
    "bowling_analysis": "",
    "auction_analysis": "",
    "home_pitch_analysis": "",
    "championship_prediction": "",
    "summary": "Full broad 350-500 word multi-paragraph tactical analysis"
  }
}`;
}

function clampRating(rating) {
    const value = Number(rating);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeBuyItem(item, defaultPlayer = "N/A") {
    if (!item) return { player: defaultPlayer, price: "N/A", rationale: "Tactical acquisition" };
    if (typeof item === 'object') {
        const player = String(item.player || item.name || defaultPlayer);
        const price = String(item.price || "N/A");
        const rationale = String(item.rationale || item.analysis || item.reason || "Tactical acquisition");
        return { player, price, rationale };
    }
    if (typeof item === 'string') {
        const match = item.match(/^([^(]+)(?:\(([^)]+)\))?\s*(?:[-–:]\s*(.*))?$/);
        if (match) {
            return {
                player: (match[1] || item).trim(),
                price: (match[2] || "").trim() || "N/A",
                rationale: (match[3] || item).trim()
            };
        }
        return { player: item, price: "N/A", rationale: item };
    }
    return { player: defaultPlayer, price: "N/A", rationale: "Tactical acquisition" };
}

function normalizeBenchReplacements(rawList, playingXi = [], substitutes = [], squadPlayers = []) {
    let list = Array.isArray(rawList) ? rawList : [];
    if (list.length === 0) {
        const starters = playingXi.slice(0, 5);
        const bench = substitutes.length > 0 ? substitutes : squadPlayers.slice(11, 16);
        list = starters.slice(0, Math.min(starters.length, bench.length)).map((st, idx) => ({
            primary_player: st.name || st,
            backup_player: bench[idx]?.name || bench[idx] || "Squad Reserve",
            role: st.role || "Key Starter",
            coverage_quality: idx === 0 ? "Adequate" : (idx === 1 ? "Elite" : "Vulnerable"),
            tactical_impact: `If ${st.name || st} is unavailable, ${bench[idx]?.name || bench[idx] || 'the reserve'} steps in as direct cover.`
        }));
    }

    return list.map(entry => {
        const primary = String(entry.primary_player || entry.primary || entry.starter || "Starter");
        const backup = String(entry.backup_player || entry.backup || entry.replacement || "Bench Option");
        const role = String(entry.role || "Role Specialist");
        let qual = String(entry.coverage_quality || "Adequate");
        const lowerQ = qual.toLowerCase();
        if (lowerQ.includes("elite") || lowerQ.includes("high") || lowerQ.includes("excellent")) qual = "Elite";
        else if (lowerQ.includes("vulner") || lowerQ.includes("poor") || lowerQ.includes("weak")) qual = "Vulnerable";
        else qual = "Adequate";

        const impact = String(entry.tactical_impact || entry.analysis || entry.impact || `Direct tactical replacement in the ${role} department.`);
        return {
            primary_player: primary,
            backup_player: backup,
            role,
            coverage_quality: qual,
            tactical_impact: impact
        };
    });
}

function normalizePhaseRatings(rawPhase, overallRating = 75) {
    const defaultScore = Math.min(10, Math.max(1, Math.round(overallRating / 10)));
    const normalizePhase = (obj, defaultName) => {
        if (!obj || typeof obj !== 'object') {
            return { score: defaultScore, analysis: `${defaultName} execution is balanced.` };
        }
        let score = parseInt(obj.score ?? obj.rating ?? defaultScore, 10);
        if (isNaN(score) || score < 0) score = defaultScore;
        if (score > 10) score = Math.round(score / 10);
        score = Math.max(1, Math.min(10, score));
        const analysis = String(obj.analysis || obj.notes || obj.verdict || `${defaultName} phase performance.`);
        return { score, analysis };
    };

    return {
        powerplay: normalizePhase(rawPhase?.powerplay, "Powerplay (Overs 1-6)"),
        middle_overs: normalizePhase(rawPhase?.middle_overs, "Middle Overs (Overs 7-15)"),
        death_overs: normalizePhase(rawPhase?.death_overs, "Death Overs (Overs 16-20)")
    };
}

function normalizeTournamentProjection(rawProj, rating = 75) {
    const defFinish = rating >= 88 ? "Champions / Finalists" : (rating >= 78 ? "Playoffs Contender (Top 4)" : (rating >= 60 ? "Mid-Table (5th-7th)" : "Wooden Spoon Risk"));
    const defProb = rating >= 88 ? "85%" : (rating >= 78 ? "65%" : (rating >= 60 ? "40%" : "15%"));
    const defOdds = rating >= 88 ? "Elite Championship Favourite" : (rating >= 78 ? "Strong Playoff Hopeful" : (rating >= 60 ? "Outside Contender" : "High Risk of Early Exit"));

    if (!rawProj || typeof rawProj !== 'object') {
        return {
            projected_finish: defFinish,
            playoff_probability: defProb,
            title_odds: defOdds
        };
    }

    return {
        projected_finish: String(rawProj.projected_finish || rawProj.finish || defFinish),
        playoff_probability: String(rawProj.playoff_probability || rawProj.probability || defProb),
        title_odds: String(rawProj.title_odds || rawProj.odds || defOdds)
    };
}

function normalizePitchSuitability(rawPitch, teamData, rating = 75) {
    const homeGround = teamData?.home_pitch || "Home Stadium";
    if (!rawPitch || typeof rawPitch !== 'object') {
        return {
            home_ground: homeGround,
            suitability_score: Math.min(10, Math.max(5, Math.round(rating / 10))),
            verdict: `Well-suited to the playing characteristics of ${homeGround}.`
        };
    }
    let score = parseInt(rawPitch.suitability_score ?? rawPitch.score ?? Math.round(rating / 10), 10);
    if (isNaN(score)) score = 7;
    if (score > 10) score = Math.round(score / 10);
    score = Math.max(1, Math.min(10, score));

    return {
        home_ground: String(rawPitch.home_ground || homeGround),
        suitability_score: score,
        verdict: String(rawPitch.verdict || rawPitch.analysis || "Tailored to home conditions.")
    };
}

function normalizeSquadMetrics(rawMetrics, rating = 75) {
    const cleanScore = (val, fallback) => {
        const num = parseInt(val, 10);
        return (!isNaN(num) && num >= 0 && num <= 100) ? num : fallback;
    };
    return {
        balance_score: cleanScore(rawMetrics?.balance_score, rating),
        star_power_score: cleanScore(rawMetrics?.star_power_score, Math.min(100, rating + 5)),
        bench_depth_score: cleanScore(rawMetrics?.bench_depth_score, Math.max(40, rating - 5))
    };
}

function translateResponseToEvaluation(response) {
    const playing11 = Array.isArray(response?.playing_xi) ? response.playing_xi.slice(0, 11) : [];
    const substitutes = Array.isArray(response?.substitutes) ? response.substitutes.slice(0, 4) : [];
    const strengths = Array.isArray(response?.strengths) ? response.strengths : [];
    const weaknesses = Array.isArray(response?.weaknesses) ? response.weaknesses : [];
    const keyPlayers = Array.isArray(response?.key_players) ? response.key_players : [];
    const summary = response?.summary || "";

    const bestBuy = response?.best_buy;
    const stealOfAuction = response?.steal_of_auction;
    const worstBuy = response?.worst_buy;

    return {
        rating: clampRating(response?.rating),
        playing_xi: playing11.map(p => p.name),
        substitutes: substitutes.map(s => s.name),
        strengths,
        weaknesses,
        key_players: keyPlayers,
        auction_grade: response?.auction_grade || "",
        summary,
        broad_summary: summary,
        best_buy: bestBuy,
        steal_of_auction: stealOfAuction,
        worst_buy: worstBuy,
        overpaid_players: response?.overpaid_players || [],
        missing_roles: response?.missing_roles || [],
        bench_like_for_like_replacements: response?.bench_like_for_like_replacements || [],
        phase_ratings: response?.phase_ratings || null,
        pitch_suitability: response?.pitch_suitability || null,
        tournament_projection: response?.tournament_projection || null,
        squad_metrics: response?.squad_metrics || null,
        overall_analysis: response?.overall_analysis || "",
        batting_analysis: response?.batting_analysis || "",
        bowling_analysis: response?.bowling_analysis || "",
        auction_analysis: response?.auction_analysis || "",
        home_pitch_analysis: response?.home_pitch_analysis || "",
        championship_prediction: response?.championship_prediction || "",
        overallScore: clampRating(response?.rating),
        battingScore: response?.phase_ratings?.powerplay?.score ? response.phase_ratings.powerplay.score * 10 : clampRating(response?.rating),
        bowlingScore: response?.phase_ratings?.death_overs?.score ? response.phase_ratings.death_overs.score * 10 : clampRating(response?.rating),
        balanceScore: response?.squad_metrics?.balance_score || clampRating(response?.rating),
        impactScore: response?.squad_metrics?.star_power_score || clampRating(response?.rating),
        starPlayer: keyPlayers[0] || playing11[0]?.name || "",
        bestValuePick: typeof stealOfAuction === 'object' ? `${stealOfAuction.player} (${stealOfAuction.price}) - ${stealOfAuction.rationale}` : (stealOfAuction || (typeof bestBuy === 'object' ? `${bestBuy.player} (${bestBuy.price})` : bestBuy) || ""),
        tacticalVerdict: summary,
        historicalContext: strengths[0] || "",
        homeGroundVerdict: response?.pitch_suitability?.verdict || response?.home_pitch_analysis || "",
        weakness: weaknesses[0] || "",
        benchAnalysis: (response?.bench_like_for_like_replacements || []).map(b => `${b.primary_player} -> ${b.backup_player} (${b.coverage_quality})`).join("; ") || substitutes.map(s => s.name).join(", "),
        playing11: playing11.map(p => p.name),
        impactPlayers: substitutes.map(s => s.name),
    };
}

function normalizeSingleTeamResult(item) {
    return {
        teamId: item.teamId,
        teamName: item.teamName,
        bestXI: {
            playing11: item.response?.playing_xi?.slice(0, 11).map(p => p.name) || [],
            impactPlayers: item.response?.substitutes?.slice(0, 4).map(s => s.name) || [],
        },
        homeXI: {
            playing11: item.response?.playing_xi?.slice(0, 11).map(p => p.name) || [],
            impactPlayers: item.response?.substitutes?.slice(0, 4).map(s => s.name) || [],
        },
        awayXI: {
            playing11: item.response?.playing_xi?.slice(0, 11).map(p => p.name) || [],
            impactPlayers: item.response?.substitutes?.slice(0, 4).map(s => s.name) || [],
        },
        evaluation: translateResponseToEvaluation(item.response),
    };
}

function robustValidateAndNormalize(rawText, teamData) {
    let parsedObj;
    try {
        parsedObj = safeParseJson(rawText);
    } catch (e) {
        console.error("[AI-PARSER] Failed initial JSON parse. Attempting fallback parse...", e.message);
        try {
            const cleaned = (rawText || "").trim();
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                const jsonText = cleaned.slice(start, end + 1);
                // Repair trailing commas
                const repaired = jsonText.replace(/,\s*([\]}])/g, '$1');
                parsedObj = JSON.parse(repaired);
            }
        } catch (subErr) {
            console.error("[AI-PARSER] Fallback parse failed:", subErr.message);
        }
    }

    if (!parsedObj || typeof parsedObj !== 'object') {
        throw new Error("UNPARSEABLE_AI_RESPONSE");
    }

    // Wrap in response if returned directly at the top level
    if (!parsedObj.response && (parsedObj.rating !== undefined || parsedObj.playing_xi !== undefined || parsedObj.summary !== undefined)) {
        parsedObj = {
            teamId: parsedObj.teamId || teamData.teamId || teamData.id || teamData.teamName,
            teamName: parsedObj.teamName || teamData.teamName || teamData.name,
            response: parsedObj
        };
    }

    // Ensure teamId and teamName exist at root
    parsedObj.teamId = String(parsedObj.teamId || teamData.teamId || teamData.id || teamData.teamName || "unknown");
    parsedObj.teamName = String(parsedObj.teamName || teamData.teamName || teamData.name || "Unknown Team");

    // Ensure response object exists
    if (!parsedObj.response || typeof parsedObj.response !== 'object') {
        parsedObj.response = {};
    }

    const resp = parsedObj.response;
    const squadPlayers = teamData.playersAcquired || [];

    // Sanitize rating: must be an integer, 0-100.
    let ratingVal = 75;
    if (resp.rating !== undefined) {
        const parsedRating = parseInt(resp.rating, 10);
        if (!isNaN(parsedRating)) {
            ratingVal = Math.max(0, Math.min(100, parsedRating));
        }
    }
    resp.rating = ratingVal;

    // Sanitize auction_grade
    if (typeof resp.auction_grade !== 'string') {
        resp.auction_grade = resp.rating >= 90 ? "A+" : (resp.rating >= 80 ? "A" : (resp.rating >= 70 ? "B+" : (resp.rating >= 60 ? "B" : (resp.rating >= 50 ? "C" : "D"))));
    }

    // Sanitize playing_xi
    const defaultPlayerNames = squadPlayers.slice(0, 11).map(p => p.name);
    if (!Array.isArray(resp.playing_xi)) {
        resp.playing_xi = defaultPlayerNames.map(name => ({ name, role: "Player" }));
    } else {
        resp.playing_xi = resp.playing_xi.map((item, idx) => {
            if (typeof item === 'string') {
                return { name: item, role: "Player" };
            }
            const name = String(item?.name || item?.player || defaultPlayerNames[idx] || "Player");
            const role = String(item?.role || "Player");
            return { name, role };
        });
    }

    // Sanitize substitutes
    const defaultSubs = squadPlayers.slice(11, 15).map(p => p.name);
    if (!Array.isArray(resp.substitutes)) {
        resp.substitutes = defaultSubs.map(name => ({ name, reason: "Backup option" }));
    } else {
        resp.substitutes = resp.substitutes.map((item, idx) => {
            if (typeof item === 'string') {
                return { name: item, reason: "Backup option" };
            }
            const name = String(item?.name || item?.player || defaultSubs[idx] || "Backup Player");
            const reason = String(item?.reason || item?.why || "Backup option");
            return { name, reason };
        });
    }

    // Helper for string arrays
    const sanitizeStringArray = (val, defaultVal = []) => {
        if (Array.isArray(val)) {
            return val.map(v => String(v || ""));
        } else if (typeof val === 'string') {
            return val.split(',').map(s => s.trim()).filter(Boolean);
        }
        return defaultVal;
    };

    resp.strengths = sanitizeStringArray(resp.strengths, ["Elite top-order firepower", "Deep bowling variety across all 20 overs"]);
    resp.weaknesses = sanitizeStringArray(resp.weaknesses, ["Vulnerable middle-order if top-order falls early"]);
    resp.key_players = sanitizeStringArray(resp.key_players, squadPlayers.slice(0, 3).map(p => p.name));

    // Helper for strings
    const sanitizeString = (val, defaultVal = "") => {
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val.join(", ");
        return defaultVal;
    };

    // Normalize Auction Valuation Metrics
    resp.best_buy = normalizeBuyItem(resp.best_buy, squadPlayers[0]?.name || "Cornerstone Pick");
    resp.steal_of_auction = normalizeBuyItem(resp.steal_of_auction, squadPlayers[1]?.name || "Smart Value Pick");
    resp.worst_buy = normalizeBuyItem(resp.worst_buy, "None Identified");

    const rawOverpaid = Array.isArray(resp.overpaid_players) ? resp.overpaid_players : [];
    resp.overpaid_players = rawOverpaid.map(op => normalizeBuyItem(op, "Inflated Acquisition"));
    resp.missing_roles = sanitizeStringArray(resp.missing_roles, []);

    // Normalize Bench Replacements (MANDATORY METRIC)
    resp.bench_like_for_like_replacements = normalizeBenchReplacements(
        resp.bench_like_for_like_replacements,
        resp.playing_xi,
        resp.substitutes,
        squadPlayers
    );

    // Normalize Phase Ratings
    resp.phase_ratings = normalizePhaseRatings(resp.phase_ratings, resp.rating);

    // Normalize Pitch Suitability
    resp.pitch_suitability = normalizePitchSuitability(resp.pitch_suitability, teamData, resp.rating);

    // Normalize Tournament Projection
    resp.tournament_projection = normalizeTournamentProjection(resp.tournament_projection, resp.rating);

    // Normalize Squad Metrics
    resp.squad_metrics = normalizeSquadMetrics(resp.squad_metrics, resp.rating);

    resp.overall_analysis = sanitizeString(resp.overall_analysis, "");
    resp.batting_analysis = sanitizeString(resp.batting_analysis, "");
    resp.bowling_analysis = sanitizeString(resp.bowling_analysis, "");
    resp.auction_analysis = sanitizeString(resp.auction_analysis, "");
    resp.home_pitch_analysis = sanitizeString(resp.home_pitch_analysis, "");
    resp.championship_prediction = sanitizeString(resp.championship_prediction, "");

    // GUARANTEE BROAD FULL-FLEDGED MULTI-PARAGRAPH SUMMARY
    let broadSummary = "";
    if (typeof resp.summary === 'string' && resp.summary.trim().length > 150) {
        broadSummary = resp.summary.trim();
    } else if (typeof parsedObj.summary === 'string' && parsedObj.summary.trim().length > 150) {
        broadSummary = parsedObj.summary.trim();
    }

    if (!broadSummary || broadSummary.length < 150) {
        const sections = [
            resp.overall_analysis,
            resp.batting_analysis,
            resp.bowling_analysis,
            resp.auction_analysis,
            resp.home_pitch_analysis,
            resp.championship_prediction
        ].filter(s => typeof s === 'string' && s.length > 25 && !s.includes("completed successfully"));

        if (sections.length >= 2) {
            broadSummary = sections.join("\n\n");
        } else {
            const teamTitle = parsedObj.teamName || "This squad";
            broadSummary = `${teamTitle} exits the auction room having constructed an intriguing tactical blueprint. The top order boasts verified match-winners capable of exploiting powerplay fielding restrictions, while the bowling attack features frontline strike weapons equipped to challenge opposition batters across differing phases.\n\nFrom a tactical phase standpoint, middle-overs control will serve as the primary barometer of their campaign. When their frontline anchors rotate strike and spin-bowlers apply sustained pressure through overs 7-15, this team will dictate terms against any contender. However, any lapses in death-overs execution could leave them exposed in high-pressure chases.\n\nBench depth and injury resilience present a crucial subplot. While the primary starting XI possesses championship-grade pedigree, their reserve bench requires like-for-like covers to step up seamlessly if primary stars face fatigue or injury setbacks. If this roster stays healthy and their core domestic contributors fire, they will firmly contend for the top half of the table.`;
        }
    }
    resp.summary = broadSummary;

    // Validate using the schema
    const validated = teamResultSchema.parse(parsedObj);
    return validated;
}

async function evaluateTeamWithGemini(teamData) {
    if (!teamData) {
        throw new Error("NO_TEAM_DATA");
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === "your_gemini_api_key") {
        throw new Error("MISSING_GEMINI_KEY");
    }

    const model = new ChatGoogleGenerativeAI({
        model: getGeminiModelName(),
        apiKey,
        apiVersion: "v1",
        temperature: 0,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
        modelKwargs: {
            response_mime_type: "application/json"
        }
    });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("GEMINI_TIMEOUT_15S")), 15000)
    );

    const resultMessage = await Promise.race([
        model.invoke(buildPrompt(teamData)),
        timeoutPromise
    ]);
    const rawText = typeof resultMessage?.content === 'string'
        ? resultMessage.content
        : Array.isArray(resultMessage?.content)
            ? resultMessage.content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
            : String(resultMessage?.content || '');

    try {
        const parsed = robustValidateAndNormalize(rawText, teamData);
        return normalizeSingleTeamResult(parsed);
    } catch (err) {
        console.error("❌ Gemini parsing failed! Raw response text was:\n", rawText);
        throw err;
    }
}

async function evaluateTeamWithGroq(teamData) {
    if (!teamData) {
        throw new Error("NO_TEAM_DATA");
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your_groq_api_key") {
        throw new Error("MISSING_GROQ_KEY");
    }

    const groq = new Groq({ apiKey });
    const modelsToTry = [...new Set([
        process.env.GROQ_MODEL,
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b"
    ].filter(Boolean))];

    let lastError = null;

    for (const currentModel of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                console.log(`[Groq-Eval] Calling ${currentModel} (attempt ${attempts + 1}/${maxAttempts})...`);
                const reqPayload = {
                    messages: [{ role: "user", content: buildPrompt(teamData) }],
                    model: currentModel,
                    temperature: 0,
                    max_tokens: 4096
                };

                // Only enforce strict json_object on attempt 1; if Groq validator chokes on reasoning, call without it
                if (attempts === 0) {
                    reqPayload.response_format = { type: "json_object" };
                }

                const chatCompletion = await groq.chat.completions.create(reqPayload);

                const rawText = chatCompletion.choices[0]?.message?.content || "";
                const parsed = robustValidateAndNormalize(rawText, teamData);
                return normalizeSingleTeamResult(parsed);
            } catch (err) {
                lastError = err;
                attempts++;

                const isRateLimit = err.status === 429 || 
                                    err.message?.includes("429") || 
                                    err.message?.toLowerCase().includes("rate limit") ||
                                    err.message?.toLowerCase().includes("limit_reached");

                if (isRateLimit && attempts < maxAttempts) {
                    const waitTime = attempts * 3000; // 3s, 6s
                    console.warn(`[Groq-Eval] ⚠️ Rate limited on ${currentModel}. Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // Break out of retry loop for non-rate-limit errors or final attempt
                    break;
                }
            }
        }

        console.warn(`[Groq-Eval] ❌ Model ${currentModel} failed: ${lastError.message}.`);
        if (currentModel !== modelsToTry[modelsToTry.length - 1]) {
            console.log(`[Groq-Eval] 🔄 Falling back to next model...`);
        }
    }

    throw lastError || new Error("GROQ_EVALUATION_FAILED");
}

async function evaluateTeamsWithGeminiBatch(teamsData) {
    if (!teamsData || !teamsData.length) {
        return { results: [] };
    }

    const results = [];
    for (const teamData of teamsData) {
        results.push(await evaluateTeamWithGemini(teamData));
    }
    return { results };
}

module.exports = {
    evaluateTeamWithGemini,
    evaluateTeamWithGroq,
    evaluateTeamsWithGeminiBatch,
    getGeminiApiKey,
    getGeminiModelName,
    buildPrompt,
    safeParseJson,
    teamResultSchema,
    normalizeSingleTeamResult,
    robustValidateAndNormalize
};
