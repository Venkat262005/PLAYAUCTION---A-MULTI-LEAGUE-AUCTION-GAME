/**
 * Diff Helper for Change Request Staging Pipeline
 * Calculates clean, field-by-field diffs and detects concurrent database modifications
 */

const normalizeValue = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number') return Number(val);
    if (typeof val === 'boolean') return Boolean(val);
    if (typeof val === 'string') return val.trim();
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
};

const areValuesEqual = (a, b) => {
    return normalizeValue(a) === normalizeValue(b);
};

/**
 * Computes deep diff between original player object and proposed updates
 */
const computePlayerDiff = (original = {}, proposed = {}) => {
    const diff = {};
    if (!original && !proposed) return diff;

    const orig = original || {};
    const prop = proposed || {};

    // Standard scalar & string player properties
    const standardFields = [
        'name', 'player', 'role', 'nationality', 'isOverseas',
        'basePrice', 'points', 'image_path', 'photoUrl', 'poolName',
        'position', 'batting_position', 'bowling_type', 'batting_style', 'bowling_style'
    ];

    standardFields.forEach((field) => {
        const oldVal = orig[field];
        const newVal = prop[field];

        if (newVal !== undefined && !areValuesEqual(oldVal, newVal)) {
            diff[field] = {
                old: oldVal !== undefined ? oldVal : null,
                new: newVal !== undefined ? newVal : null
            };
        }
    });

    // Check stats subdocument
    const origStats = orig.stats || {};
    const propStats = prop.stats || {};
    const statsKeys = new Set([...Object.keys(origStats), ...Object.keys(propStats)]);

    statsKeys.forEach((key) => {
        const oldVal = origStats[key];
        const newVal = propStats[key];
        if (newVal !== undefined && !areValuesEqual(oldVal, newVal)) {
            diff[`stats.${key}`] = {
                old: oldVal !== undefined ? oldVal : null,
                new: newVal !== undefined ? newVal : null
            };
        }
    });

    // Check form subdocument
    const origForm = orig.form || {};
    const propForm = prop.form || {};
    ['score', 'trend', 'lastMatches'].forEach((key) => {
        const oldVal = origForm[key];
        const newVal = propForm[key];
        if (newVal !== undefined && !areValuesEqual(oldVal, newVal)) {
            diff[`form.${key}`] = {
                old: oldVal !== undefined ? oldVal : null,
                new: newVal !== undefined ? newVal : null
            };
        }
    });

    // Catch any remaining root fields in proposed that weren't in standard list
    Object.keys(prop).forEach((key) => {
        if (
            !standardFields.includes(key) &&
            key !== 'stats' &&
            key !== 'form' &&
            key !== '_id' &&
            key !== 'id' &&
            key !== 'createdAt' &&
            key !== 'updatedAt' &&
            key !== '__v'
        ) {
            const oldVal = orig[key];
            const newVal = prop[key];
            if (newVal !== undefined && !areValuesEqual(oldVal, newVal)) {
                diff[key] = {
                    old: oldVal !== undefined ? oldVal : null,
                    new: newVal !== undefined ? newVal : null
                };
            }
        }
    });

    return diff;
};

/**
 * Live Conflict Detection:
 * Compares current document in master DB against original snapshot taken when draft was created.
 * If another user has merged changes in the interim, detects which fields differ.
 */
const checkConcurrentConflict = (originalSnapshot, currentMasterDoc) => {
    if (!currentMasterDoc) {
        return {
            hasConflict: true,
            conflictType: 'DOCUMENT_DELETED',
            message: 'The target document was deleted from the database after this draft was created.'
        };
    }

    if (!originalSnapshot) {
        return { hasConflict: false };
    }

    // Check if the current doc in DB has diverged from original snapshot
    const divergedDiff = computePlayerDiff(originalSnapshot, currentMasterDoc);
    const conflictingFields = Object.keys(divergedDiff);

    if (conflictingFields.length > 0) {
        return {
            hasConflict: true,
            conflictType: 'MODIFIED_BY_OTHER',
            message: `Document was modified in primary DB after this draft was created (${conflictingFields.length} field(s) changed).`,
            divergedFields: divergedDiff
        };
    }

    return { hasConflict: false };
};

module.exports = {
    computePlayerDiff,
    checkConcurrentConflict,
    areValuesEqual
};
