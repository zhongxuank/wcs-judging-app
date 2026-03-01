import { useState, useEffect } from 'react';
import { judgeAPI } from '../../services/api';
import type { Judge } from '../../types';

interface JudgeAssignmentProps {
    chiefJudge: Judge;
    competitionId: string;
    onComplete: (judges: { leaders: Judge[], followers: Judge[] }) => void;
    onBack: () => void;
    isSubmitting?: boolean;
}

export const JudgeAssignment = ({ chiefJudge, competitionId, onComplete, onBack, isSubmitting: externalSubmitting }: JudgeAssignmentProps) => {
    const [judgeCount, setJudgeCount] = useState<3 | 5 | 7>(3);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Automatically create judge slots when count changes
    useEffect(() => {
        // Create 2 * judgeCount slots (for both leader and follower roles)
        const newJudges: Judge[] = Array.from({ length: judgeCount * 2 }, () => ({
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
            const validJudges = judges
                .filter(j => j.name.trim() !== '')
                .map(j => ({
                    name: j.name,
                    is_chief_judge: false,
                    assigned_role: j.assigned_role || 'leader'
                }));

            // Also add the chief judge
            const allJudges = [
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Number of Judges per Role
                </label>
                <div className="mt-2 space-x-4">
                    {[3, 5, 7].map((count) => (
                        <button
                            key={count}
                            type="button"
                            onClick={() => !isLoading && setJudgeCount(count as 3 | 5 | 7)}
                            disabled={isLoading}
                            className={`px-4 py-2 rounded ${
                                judgeCount === count
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {count}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-sm text-gray-600">
                    Selected: {judgeCount} judges per role ({judgeCount * 2} total judges needed)
                </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-medium">Chief Judge</h3>
                <div className="mt-2 p-4 bg-gray-50 rounded">
                    <p>{chiefJudge.name} (Judging both roles)</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium mb-4">Judge Assignments</h3>
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                        {judges.map((judge, index) => (
                            <div key={judge.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded">
                                <input
                                    type="text"
                                    value={judge.name}
                                    onChange={(e) => handleJudgeNameChange(index, e.target.value)}
                                    placeholder={`Judge ${index + 1} Name`}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    required
                                    disabled={isLoading}
                                />
                                <select
                                    value={judge.assigned_role || ''}
                                    onChange={(e) => handleRoleAssignment(index, e.target.value as 'leader' | 'follower')}
                                    className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    required
                                    disabled={isLoading}
                                >
                                    <option value="">Select Role</option>
                                    <option value="leader">Leader Judge</option>
                                    <option value="follower">Follower Judge</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded">
                    <h4 className="text-sm font-medium text-blue-900">Current Assignment Status</h4>
                    <div className="mt-2 text-sm text-blue-700">
                        <p>Leader Judges: {currentCounts.leaderCount} of {judgeCount} assigned</p>
                        <p>Follower Judges: {currentCounts.followerCount} of {judgeCount} assigned</p>
                    </div>
                </div>

                <div className="flex justify-between pt-4">
                    <button
                        type="button"
                        onClick={onBack}
                        disabled={isLoading}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={!isFormValid || isLoading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Saving...' : 'Next: Competitor Import'}
                    </button>
                </div>
            </form>
        </div>
    );
};