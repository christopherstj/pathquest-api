/**
 * Search term expansion helper for fuzzy peak search
 * Expands common abbreviations to their full forms
 */

// Map of abbreviations to their expanded forms
const SEARCH_SYNONYMS: Record<string, string[]> = {
    // Mountain prefixes
    mt: ["mount", "mountain"],
    mtn: ["mountain", "mount"],
    mts: ["mountains"],
    
    // Peak types
    pk: ["peak"],
    pks: ["peaks"],
    pt: ["point"],
    
    // Directions
    n: ["north"],
    s: ["south"],
    e: ["east"],
    w: ["west"],
    ne: ["northeast"],
    nw: ["northwest"],
    se: ["southeast"],
    sw: ["southwest"],
    
    // Common abbreviations
    ft: ["fort"],
    st: ["saint"],
    lk: ["lake"],
    
    // State-related (less common but useful)
    nh: ["new hampshire"],
    co: ["colorado"],
    ca: ["california"],
    wa: ["washington"],
};

/**
 * Expands a search term by replacing known abbreviations with their full forms
 * Returns an array of search variations to try
 * 
 * @param search - The original search term
 * @returns Array of expanded search variations
 */
export const expandSearchTerm = (search: string): string[] => {
    const normalizedSearch = search.trim().toLowerCase();
    const words = normalizedSearch.split(/\s+/);
    
    // Generate all variations by expanding each word
    const variations: string[] = [normalizedSearch];
    
    // Try expanding each word and create variations
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const expansions = SEARCH_SYNONYMS[word];
        
        if (expansions) {
            for (const expansion of expansions) {
                const newWords = [...words];
                newWords[i] = expansion;
                const variation = newWords.join(" ");
                if (!variations.includes(variation)) {
                    variations.push(variation);
                }
            }
        }
    }
    
    return variations;
};

/**
 * Gets the primary expanded form of a search term
 * Used for the main similarity comparison
 * 
 * @param search - The original search term
 * @returns The most likely intended search term
 */
export const getPrimaryExpansion = (search: string): string => {
    const normalizedSearch = search.trim().toLowerCase();
    const words = normalizedSearch.split(/\s+/);
    
    // Replace abbreviations with their primary (first) expansion
    const expandedWords = words.map(word => {
        const expansions = SEARCH_SYNONYMS[word];
        return expansions ? expansions[0] : word;
    });
    
    return expandedWords.join(" ");
};

/**
 * Builds a SQL pattern for fuzzy matching across all variations
 * Returns patterns suitable for ILIKE matching
 * 
 * @param search - The original search term
 * @returns Array of SQL ILIKE patterns
 */
export const buildSearchPatterns = (search: string): string[] => {
    const variations = expandSearchTerm(search);
    return variations.map(v => `%${v}%`);
};

export default expandSearchTerm;

