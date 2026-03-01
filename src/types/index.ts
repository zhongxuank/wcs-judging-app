export interface Competitor {
    id: string;
    bib_number: string;
    name: string;
    role: 'leader' | 'follower';
    created_at?: string;
}

export interface Judge {
    id: string;
    name: string;
    is_chief_judge?: boolean;
    assigned_role?: 'leader' | 'follower' | 'both';
    created_at?: string;
}

export interface Heat {
    id: string;
    number: number;
    leaders: Competitor[];
    followers: Competitor[];
    is_complete?: boolean;
    created_at?: string;
}

export interface Round {
    id: string;
    number: number;
    round_type: 'preliminary' | 'final';
    heat_size: number;
    heats?: Heat[];
    judges?: {
        leaders: Judge[];
        followers: Judge[];
    };
    required_yes_count?: number;
    advancing_count?: number;
    alternate_count?: 2 | 3;
    is_active?: boolean;
    is_complete?: boolean;
    created_at?: string;
}

export interface PreliminaryScore {
    id?: string;
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
    created_at?: string;
    updated_at?: string;
}

export interface FinalScore {
    id?: string;
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
    created_at?: string;
    updated_at?: string;
}

export type Score = PreliminaryScore | FinalScore;

export interface Competition {
    id: string;
    name: string;
    date: string;
    chief_judge_name: string;
    status: 'setup' | 'in_progress' | 'completed';
    current_round: number;
    rounds?: Round[];
    judges?: Judge[];
    competitors?: Competitor[];
    competitor_count?: number;
    judge_count?: number;
    round_count?: number;
    created_at?: string;
    updated_at?: string;
}