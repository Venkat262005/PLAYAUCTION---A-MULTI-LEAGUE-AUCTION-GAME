const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { z } = require("zod");

function getGeminiApiKey() {
    return process.env.GOOGLE_API_KEY
        || process.env.GOOGLE_GEMINI_API_KEY
        || process.env.GEMINI_API_KEY;
}

function getGeminiModelName() {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

const requestedResponseSchema = z.object({
    rating: z.number().default(0),
    playing_xi: z.array(z.string()).default([]),
    substitutes: z.array(z.string()).default([]),
    strengths: z.array(z.string()).default([]),
    weaknesses: z.array(z.string()).default([]),
    key_players: z.array(z.string()).default([]),
    auction_grade: z.string().default(""),
    summary: z.string().default(""),
});

const teamResultSchema = z.object({
    teamId: z.string(),
    teamName: z.string().optional(),
    response: requestedResponseSchema,
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
    return JSON.stringify({
        task: "analyze_one_team",
        instructions: [
            "Analyze the cricket squad JSON.",
            "Select the best Playing XI and 4 substitutes.",
            "Evaluate batting, bowling, spin, pace, fielding, and team balance.",
            "Return ONLY valid JSON with the exact schema.",
            "No markdown. No extra text.",
            "Keep every array item short.",
            "Use exactly 11 names in playing_xi and exactly 4 names in substitutes.",
            "Use exactly 3 short strengths, exactly 3 short weaknesses, and exactly 3 key players.",
            "Keep summary to one sentence under 25 words.",
            "Keep each list item under 8 words."
        ],
        input: {
            teamId: teamData.teamId || teamData.id || teamData.teamName,
            teamName: teamData.teamName || teamData.name,
            home_pitch: teamData.home_pitch || "Flat",
            budget: teamData.budget || {},
            squad: (teamData.playersAcquired || []).map(p => ({
                name: p.name,
                role: p.role,
                isOverseas: !!p.isOverseas,
                isU23: !!p.isU23,
                isUncapped: !!p.isUncapped,
                points: p.points || 0
            }))
        },
        output_format: {
            teamId: "string",
            teamName: "string",
            response: {
                rating: 0,
                playing_xi: ["names"],
                substitutes: ["names"],
                strengths: ["3 short strengths"],
                weaknesses: ["3 short weaknesses"],
                key_players: ["names"],
                auction_grade: "string",
                summary: "string"
            }
        }
    });
}

function clampRating(rating) {
    const value = Number(rating);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(10, Math.round(value)));
}

function translateResponseToEvaluation(response) {
    const playing11 = Array.isArray(response?.playing_xi) ? response.playing_xi.slice(0, 11) : [];
    const substitutes = Array.isArray(response?.substitutes) ? response.substitutes.slice(0, 4) : [];
    const strengths = Array.isArray(response?.strengths) ? response.strengths : [];
    const weaknesses = Array.isArray(response?.weaknesses) ? response.weaknesses : [];
    const keyPlayers = Array.isArray(response?.key_players) ? response.key_players : [];
    const summary = response?.summary || "";

    return {
        rating: clampRating(response?.rating),
        playing_xi: playing11,
        substitutes,
        strengths,
        weaknesses,
        key_players: keyPlayers,
        auction_grade: response?.auction_grade || "",
        summary,
        overallScore: clampRating(response?.rating) * 10,
        battingScore: clampRating(response?.rating) * 10,
        bowlingScore: clampRating(response?.rating) * 10,
        balanceScore: clampRating(response?.rating) * 10,
        impactScore: clampRating(response?.rating) * 10,
        starPlayer: keyPlayers[0] || playing11[0] || "",
        bestValuePick: substitutes[0] || "",
        tacticalVerdict: summary,
        historicalContext: strengths[0] || "",
        homeGroundVerdict: "",
        weakness: weaknesses[0] || "",
        benchAnalysis: substitutes.join(", "),
        playing11,
        impactPlayers: substitutes,
    };
}

function normalizeSingleTeamResult(item) {
    return {
        teamId: item.teamId,
        teamName: item.teamName,
        bestXI: {
            playing11: item.response?.playing_xi?.slice(0, 11) || [],
            impactPlayers: item.response?.substitutes?.slice(0, 4) || [],
        },
        homeXI: {
            playing11: item.response?.playing_xi?.slice(0, 11) || [],
            impactPlayers: item.response?.substitutes?.slice(0, 4) || [],
        },
        awayXI: {
            playing11: item.response?.playing_xi?.slice(0, 11) || [],
            impactPlayers: item.response?.substitutes?.slice(0, 4) || [],
        },
        evaluation: translateResponseToEvaluation(item.response),
    };
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
        maxOutputTokens: 4096,
        modelKwargs: {
            response_mime_type: "application/json"
        }
    });
    const resultMessage = await model.invoke(buildPrompt(teamData));
    const rawText = typeof resultMessage?.content === 'string'
        ? resultMessage.content
        : Array.isArray(resultMessage?.content)
            ? resultMessage.content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
            : String(resultMessage?.content || '');

    const parsed = teamResultSchema.parse(safeParseJson(rawText));
    return normalizeSingleTeamResult(parsed);
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
    evaluateTeamsWithGeminiBatch,
    getGeminiApiKey,
    getGeminiModelName,
};
