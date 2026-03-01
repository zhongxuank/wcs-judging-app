/**
 * Input and form state types for API requests and UI.
 * Separate from API response types to avoid overloading a single interface.
 */

/** Payload for creating a judge via API */
export interface JudgeCreateInput {
    name: string;
    is_chief_judge: boolean;
    assigned_role: 'leader' | 'follower' | 'both';
}

/** Form/draft state for a judge before save (assigned_role can be undefined until user selects) */
export interface JudgeFormState {
    id?: string;
    name: string;
    is_chief_judge: boolean;
    assigned_role?: 'leader' | 'follower' | 'both';
}

/** Payload for creating a competitor via API */
export interface CompetitorCreateInput {
    bib_number: string;
    name: string;
    role: 'leader' | 'follower';
}
