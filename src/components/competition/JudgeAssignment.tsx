import { useState, useEffect } from 'react';
import { judgeAPI } from '../../services/api';
import type { Judge, JudgeFormState, JudgeCreateInput } from '../../types';

interface JudgeAssignmentProps {
    chiefJudge: JudgeFormState;
    competitionId: string;
    initialJudgeCount?: number;
    onComplete: (judges: { leaders: Judge[]; followers: Judge[] }) => void;
    onBack: () => void;
    isSubmitting?: boolean;
}

export const JudgeAssignment = ({ chiefJudge, competitionId, initialJudgeCount = 3, onComplete, onBack, isSubmitting: externalSubmitting }: JudgeAssignmentProps) => {
    const [judgeCount, setJudgeCount] = useState<number>(initialJudgeCount);
    const [judges, setJudges] = useState<JudgeFormState[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync with parent when initialJudgeCount changes
    useEffect(() => {
        setJudgeCount(initialJudgeCount);
    }, [initialJudgeCount]);

    // Automatically create judge slots when count changes
    useEffect(() => {
        // Create 2 * judgeCount slots (for both leader and follower roles)
        const newJudges: JudgeFormState[] = Array.from({ length: judgeCount * 2 }, () => ({
            id: crypto.randomUUID(),
            name: '',
            is_chief_judge: false,
            assigned_role: undefined
        }));
        setJudges(newJudges);
    }, [judgeCount]);

    const handleJudgeNameChange = (index: number, name: string) => {
        const newJudges = [...judges];
        newJudges[index] = { ...newJudges[index], name };
        setJudges(newJudges);
    };

    const handleRoleAssignment = (index: number, role: 'leader' | 'follower') => {
        const newJudges = [...judges];
        newJudges[index] = { ...newJudges[index], assigned_role: role };
        setJudges(newJudges);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Prepare judges for API (exclude empty names)
            const validJudges: JudgeCreateInput[] = judges
                .filter((j): j is JudgeFormState & { assigned_role: 'leader' | 'follower' } => 
                    j.name.trim() !== '' && (j.assigned_role === 'leader' || j.assigned_role === 'follower')
                )
                .map(j => ({
                    name: j.name,
                    is_chief_judge: false,
                    assigned_role: j.assigned_role
                }));

            // Also add the chief judge
            const allJudges: JudgeCreateInput[] = [
                ...validJudges,
                {
                    name: chiefJudge.name,
                    is_chief_judge: true,
                    assigned_role: 'both'
                }
            ];

            // Send to API using bulk create
            const createdJudges = await judgeAPI.bulkCreate(competitionId, allJudges);

            // Convert API response to local Judge type
            const leaderJudges: Judge[] = createdJudges
                .filter(j => !j.is_chief_judge && j.assigned_role === 'leader');
            
            const followerJudges: Judge[] = createdJudges
                .filter(j => !j.is_chief_judge && j.assigned_role === 'follower');

            onComplete({ leaders: leaderJudges, followers: followerJudges });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save judges');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = () => {
        const leaderCount = judges.filter(j => j.assigned_role === 'leader' && j.name.trim() !== '').length;
        const followerCount = judges.filter(j => j.assigned_role === 'follower' && j.name.trim() !== '').length;
        return leaderCount === judgeCount && followerCount === judgeCount;
    };

    // Helper to show current judge allocation
    const getCurrentCounts = () => {
        const leaderCount = judges.filter(j => j.assigned_role === 'leader' && j.name.trim() !== '').length;
        const followerCount = judges.filter(j => j.assigned_role === 'follower' && j.name.trim() !== '').length;
        return { leaderCount, followerCount };
    };

    const currentCounts = getCurrentCounts();
    const isFormValid = isValid();
    const isLoading = isSubmitting || externalSubmitting;

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div>
                <span className="label mb-3 block">Number of Judges per Role</span>
                <p className="mb-2 text-sm text-slate-500">
                    {judgeCount} judges per role ({judgeCount * 2} total needed) — selected in Basic Info
                </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="section-title mb-2">Chief Judge</h3>
                <p className="text-sm text-slate-600">{chiefJudge.name} <span className="text-slate-400">(Judging both roles)</span></p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h3 className="section-title mb-4">Judge Assignments</h3>
                    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/30 p-3">
                        {judges.map((judge, index) => (
                            <div key={judge.id} className="flex items-center gap-3 rounded-md bg-white p-2 shadow-sm">
                                <input
                                    type="text"
                                    value={judge.name}
                                    onChange={(e) => handleJudgeNameChange(index, e.target.value)}
                                    placeholder={`Judge ${index + 1} Name`}
                                    className="input-base flex-1"
                                    required
                                    disabled={isLoading}
                                />
                                <select
                                    value={judge.assigned_role || ''}
                                    onChange={(e) => handleRoleAssignment(index, e.target.value as 'leader' | 'follower')}
                                    className="input-base w-36 shrink-0"
                                    required
                                    disabled={isLoading}
                                >
                                    <option value="">Select Role</option>
                                    <option value="leader">Leader</option>
                                    <option value="follower">Follower</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
                    <h4 className="text-sm font-medium text-indigo-900">Assignment Status</h4>
                    <p className="mt-1 text-sm text-indigo-700">
                        Leader Judges: {currentCounts.leaderCount} of {judgeCount} · Follower Judges: {currentCounts.followerCount} of {judgeCount}
                    </p>
                </div>

                <div className="flex justify-between gap-4 border-t border-slate-200 pt-6">
                    <button type="button" onClick={onBack} disabled={isLoading} className="btn-secondary">
                        Back
                    </button>
                    <button type="submit" disabled={!isFormValid || isLoading} className="btn-primary">
                        {isLoading ? 'Saving...' : 'Next: Competitors'}
                    </button>
                </div>
            </form>
        </div>
    );
};