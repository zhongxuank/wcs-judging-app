export interface Competitor {
    id: string;
    bibNumber: string;
    name: string;
    role: 'leader' | 'follower';
}

export interface Judge {
    id: string;
    name: string;
    isChiefJudge?: boolean;
    assignedRole?: 'leader' | 'follower' | 'both';
}

export interface Heat {
    id: string;
    number: number;
    leaders: Competitor[];
    followers: Competitor[];
}

export interface Round {
    id: string;
    number: number;
    type: 'preliminary' | 'final';
    heats: Heat[];
    judges: {
        leaders: Judge[];
        followers: Judge[];
    };
    requiredYesCount: number;
    advancingCount: number;
}

export interface Score {
    judgeId: string;
    competitorId: string;
    roundId: string;
    heatId: string;
    rawScore: number;
    calculatedResult?: 'yes' | 'alt1' | 'alt2' | 'alt3' | 'no';
    points?: number;
}

export interface Competition {
    id: string;
    name: string;
    rounds: Round[];
    chiefJudge: Judge;
    currentRound: number;
    status: 'setup' | 'in-progress' | 'completed';
}
