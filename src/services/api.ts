/**
 * API service for communicating with Django backend
 */

// In development, Vite proxy handles the /api path
// In production, Django serves the API at /api
const API_BASE_URL = '/api';

// Helper for making API requests
async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Handle empty responses
    if (response.status === 204) {
        return {} as T;
    }
    
    return response.json();
}

// Types matching Django API responses
export interface Competition {
    id: string;
    name: string;
    date: string;
    chief_judge_name: string;
    status: 'setup' | 'in_progress' | 'completed';
    current_round: number;
    judges?: Judge[];
    competitors?: Competitor[];
    rounds?: Round[];
    competitor_count?: number;
    judge_count?: number;
    round_count?: number;
    created_at: string;
    updated_at: string;
}

export interface Judge {
    id: string;
    name: string;
    is_chief_judge: boolean;
    assigned_role: 'leader' | 'follower' | 'both';
    created_at: string;
}

export interface Competitor {
    id: string;
    bib_number: string;
    name: string;
    role: 'leader' | 'follower';
    created_at: string;
}

export interface Round {
    id: string;
    number: number;
    round_type: 'preliminary' | 'final';
    heat_size: number;
    required_yes_count: number;
    advancing_count: number;
    alternate_count: 2 | 3;
    heats?: Heat[];
    judges?: Judge[];
    heat_count?: number;
    is_active: boolean;
    is_complete: boolean;
    created_at: string;
}

export interface Heat {
    id: string;
    number: number;
    leaders: Competitor[];
    followers: Competitor[];
    leader_ids?: string[];
    follower_ids?: string[];
    is_complete: boolean;
    created_at: string;
}

export interface PreliminaryScore {
    id: string;
    judge: string;
    judge_name?: string;
    competitor: string;
    competitor_name?: string;
    competitor_bib?: string;
    round: string;
    heat: string;
    raw_score: number;
    calculated_result?: 'yes' | 'alt1' | 'alt2' | 'alt3' | 'no';
    points?: number;
    created_at: string;
    updated_at: string;
}

export interface FinalScore {
    id: string;
    judge: string;
    judge_name?: string;
    competitor: string;
    competitor_name?: string;
    competitor_bib?: string;
    round: string;
    raw_score?: number;
    technique_score?: number;
    timing_score?: number;
    presentation_score?: number;
    created_at: string;
    updated_at: string;
}

export interface RoundResult {
    competitor: Competitor;
    total_points?: number;
    yes_count?: number;
    alt_count?: number;
    score_count: number;
    total_score?: number;
    technique_total?: number;
    timing_total?: number;
    presentation_total?: number;
    average_score?: number;
    technique_avg?: number;
    timing_avg?: number;
    presentation_avg?: number;
}

// Competition API
export const competitionAPI = {
    // Get all competitions
    list: () => fetchAPI<Competition[]>('/competitions/'),
    
    // Get single competition
    get: (id: string) => fetchAPI<Competition>(`/competitions/${id}/`),
    
    // Create competition
    create: (data: Partial<Competition>) =>
        fetchAPI<Competition>('/competitions/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Update competition
    update: (id: string, data: Partial<Competition>) =>
        fetchAPI<Competition>(`/competitions/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete competition
    delete: (id: string) =>
        fetchAPI<void>(`/competitions/${id}/`, {
            method: 'DELETE',
        }),
    
    // Activate a round
    activateRound: (id: string, roundNumber: number) =>
        fetchAPI<{ status: string }>(`/competitions/${id}/activate_round/`, {
            method: 'POST',
            body: JSON.stringify({ round_number: roundNumber }),
        }),
    
    // Complete competition
    complete: (id: string) =>
        fetchAPI<{ status: string }>(`/competitions/${id}/complete/`, {
            method: 'POST',
        }),
};

// Judge API
export const judgeAPI = {
    // List judges (optionally filter by competition)
    list: (competitionId?: string) => {
        const params = competitionId ? `?competition=${competitionId}` : '';
        return fetchAPI<Judge[]>(`/judges/${params}`);
    },
    
    // Get single judge
    get: (id: string) => fetchAPI<Judge>(`/judges/${id}/`),
    
    // Create judge
    create: (data: Partial<Judge>) =>
        fetchAPI<Judge>('/judges/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Bulk create judges
    bulkCreate: (competitionId: string, judges: Partial<Judge>[]) =>
        fetchAPI<Judge[]>('/judges/bulk_create/', {
            method: 'POST',
            body: JSON.stringify({
                competition_id: competitionId,
                judges,
            }),
        }),
    
    // Update judge
    update: (id: string, data: Partial<Judge>) =>
        fetchAPI<Judge>(`/judges/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete judge
    delete: (id: string) =>
        fetchAPI<void>(`/judges/${id}/`, {
            method: 'DELETE',
        }),
};

// Competitor API
export const competitorAPI = {
    // List competitors (optionally filter by competition or role)
    list: (params?: { competition?: string; role?: string }) => {
        const searchParams = new URLSearchParams();
        if (params?.competition) searchParams.append('competition', params.competition);
        if (params?.role) searchParams.append('role', params.role);
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return fetchAPI<Competitor[]>(`/competitors/${query}`);
    },
    
    // Get single competitor
    get: (id: string) => fetchAPI<Competitor>(`/competitors/${id}/`),
    
    // Create competitor
    create: (data: Partial<Competitor>) =>
        fetchAPI<Competitor>('/competitors/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Bulk create competitors
    bulkCreate: (competitionId: string, competitors: Partial<Competitor>[]) =>
        fetchAPI<Competitor[]>('/competitors/bulk_create/', {
            method: 'POST',
            body: JSON.stringify({
                competition_id: competitionId,
                competitors,
            }),
        }),
    
    // Import competitors from CSV
    importCSV: (competitionId: string, csvData: string) =>
        fetchAPI<{
            created: number;
            competitors: Competitor[];
            errors: string[];
        }>('/competitors/import_csv/', {
            method: 'POST',
            body: JSON.stringify({
                competition_id: competitionId,
                csv_data: csvData,
            }),
        }),
    
    // Update competitor
    update: (id: string, data: Partial<Competitor>) =>
        fetchAPI<Competitor>(`/competitors/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete competitor
    delete: (id: string) =>
        fetchAPI<void>(`/competitors/${id}/`, {
            method: 'DELETE',
        }),
};

// Round API
export const roundAPI = {
    // List rounds (optionally filter by competition)
    list: (competitionId?: string) => {
        const params = competitionId ? `?competition=${competitionId}` : '';
        return fetchAPI<Round[]>(`/rounds/${params}`);
    },
    
    // Get single round
    get: (id: string) => fetchAPI<Round>(`/rounds/${id}/`),
    
    // Create round
    create: (data: Partial<Round>) =>
        fetchAPI<Round>('/rounds/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Update round
    update: (id: string, data: Partial<Round>) =>
        fetchAPI<Round>(`/rounds/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete round
    delete: (id: string) =>
        fetchAPI<void>(`/rounds/${id}/`, {
            method: 'DELETE',
        }),
    
    // Generate heats for a round
    generateHeats: (id: string, heatSize?: number) =>
        fetchAPI<{ created: number; heats: Heat[] }>(`/rounds/${id}/generate_heats/`, {
            method: 'POST',
            body: heatSize ? JSON.stringify({ heat_size: heatSize }) : undefined,
        }),
    
    // Get round results
    getResults: (id: string) =>
        fetchAPI<{ round: Round; results: RoundResult[] }>(`/rounds/${id}/results/`),
};

// Heat API
export const heatAPI = {
    // List heats (optionally filter by round)
    list: (roundId?: string) => {
        const params = roundId ? `?round=${roundId}` : '';
        return fetchAPI<Heat[]>(`/heats/${params}`);
    },
    
    // Get single heat
    get: (id: string) => fetchAPI<Heat>(`/heats/${id}/`),
    
    // Create heat
    create: (data: Partial<Heat>) =>
        fetchAPI<Heat>('/heats/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Update heat
    update: (id: string, data: Partial<Heat>) =>
        fetchAPI<Heat>(`/heats/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete heat
    delete: (id: string) =>
        fetchAPI<void>(`/heats/${id}/`, {
            method: 'DELETE',
        }),
};

// Preliminary Score API
export const preliminaryScoreAPI = {
    // List scores (optionally filter)
    list: (params?: { round?: string; judge?: string; heat?: string }) => {
        const searchParams = new URLSearchParams();
        if (params?.round) searchParams.append('round', params.round);
        if (params?.judge) searchParams.append('judge', params.judge);
        if (params?.heat) searchParams.append('heat', params.heat);
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return fetchAPI<PreliminaryScore[]>(`/preliminary-scores/${query}`);
    },
    
    // Get single score
    get: (id: string) => fetchAPI<PreliminaryScore>(`/preliminary-scores/${id}/`),
    
    // Create score
    create: (data: Partial<PreliminaryScore>) =>
        fetchAPI<PreliminaryScore>('/preliminary-scores/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Bulk submit scores
    bulkSubmit: (
        judgeId: string,
        roundId: string,
        heatId: string,
        scores: { competitor_id: string; raw_score: number }[]
    ) =>
        fetchAPI<{
            submitted: number;
            scores: PreliminaryScore[];
            errors: string[];
        }>('/preliminary-scores/bulk_submit/', {
            method: 'POST',
            body: JSON.stringify({
                judge_id: judgeId,
                round_id: roundId,
                heat_id: heatId,
                scores,
            }),
        }),
    
    // Update score
    update: (id: string, data: Partial<PreliminaryScore>) =>
        fetchAPI<PreliminaryScore>(`/preliminary-scores/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete score
    delete: (id: string) =>
        fetchAPI<void>(`/preliminary-scores/${id}/`, {
            method: 'DELETE',
        }),
};

// Final Score API
export const finalScoreAPI = {
    // List scores (optionally filter)
    list: (params?: { round?: string; judge?: string }) => {
        const searchParams = new URLSearchParams();
        if (params?.round) searchParams.append('round', params.round);
        if (params?.judge) searchParams.append('judge', params.judge);
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return fetchAPI<FinalScore[]>(`/final-scores/${query}`);
    },
    
    // Get single score
    get: (id: string) => fetchAPI<FinalScore>(`/final-scores/${id}/`),
    
    // Create score
    create: (data: Partial<FinalScore>) =>
        fetchAPI<FinalScore>('/final-scores/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    
    // Update score
    update: (id: string, data: Partial<FinalScore>) =>
        fetchAPI<FinalScore>(`/final-scores/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    
    // Delete score
    delete: (id: string) =>
        fetchAPI<void>(`/final-scores/${id}/`, {
            method: 'DELETE',
        }),
};

// Export all APIs
export const api = {
    competitions: competitionAPI,
    judges: judgeAPI,
    competitors: competitorAPI,
    rounds: roundAPI,
    heats: heatAPI,
    preliminaryScores: preliminaryScoreAPI,
    finalScores: finalScoreAPI,
};

export default api;