import { useState, useEffect } from 'react';
import { preliminaryScoreAPI } from '../../services/api';
import type { Competitor, PreliminaryScore } from '../../types';

interface ScoringInterfaceProps {
    competitors: Competitor[];
    roundId: string;
    heatId: string;
    judgeId: string;
    onScoreSubmit?: (scores: PreliminaryScore[]) => void;
}

export const ScoringInterface = ({
    competitors,
    roundId,
    heatId,
    judgeId,
    onScoreSubmit
}: ScoringInterfaceProps) => {
    const [scores, setScores] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [existingScores, setExistingScores] = useState<PreliminaryScore[]>([]);

    // Load existing scores when component mounts
    useEffect(() => {
        const loadExistingScores = async () => {
            try {
                const scores = await preliminaryScoreAPI.list({
                    round: roundId,
                    heat: heatId,
                    judge: judgeId
                });
                
                // Convert to local state
                const scoreMap: Record<string, number> = {};
                scores.forEach(s => {
                    scoreMap[s.competitor] = s.raw_score;
                });
                setScores(scoreMap);
                setExistingScores(scores);
            } catch (err) {
                // Silently fail - no existing scores is okay
                console.log('No existing scores found');
            }
        };

        loadExistingScores();
    }, [roundId, heatId, judgeId]);

    const handleScoreChange = (competitorId: string, score: number) => {
        setScores(prev => ({
            ...prev,
            [competitorId]: score
        }));
        setSuccess(false);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);

        try {
            // Prepare scores for API
            const scoresData = Object.entries(scores).map(([competitorId, rawScore]) => ({
                competitor_id: competitorId,
                raw_score: rawScore
            }));

            // Submit via API
            const result = await preliminaryScoreAPI.bulkSubmit(
                judgeId,
                roundId,
                heatId,
                scoresData
            );

            if (result.errors && result.errors.length > 0) {
                setError(`Some scores failed to save: ${result.errors.join(', ')}`);
            } else {
                setSuccess(true);
                if (onScoreSubmit) {
                    onScoreSubmit(result.scores);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit scores');
        } finally {
            setIsSubmitting(false);
        }
    };

    const allScoresEntered = competitors.every(c => scores[c.id] !== undefined);
    const scoreCount = Object.keys(scores).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Scoring Interface</h2>
                <div className="text-sm text-gray-500">
                    {scoreCount} of {competitors.length} scored
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">Scores submitted successfully!</p>
                </div>
            )}

            <div className="space-y-4">
                {competitors.map(competitor => (
                    <div key={competitor.id} className="border p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-bold">#{competitor.bibNumber}</span>
                                <span className="ml-2">{competitor.name}</span>
                                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                    competitor.role === 'leader' 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-pink-100 text-pink-800'
                                }`}>
                                    {competitor.role}
                                </span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={scores[competitor.id] || 0}
                                    onChange={(e) => handleScoreChange(competitor.id, Number(e.target.value))}
                                    className="w-48"
                                    disabled={isSubmitting}
                                />
                                <span className="w-12 text-right font-mono font-bold">
                                    {scores[competitor.id] || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-500">
                    {existingScores.length > 0 && (
                        <span className="text-blue-600">
                            Previously saved scores loaded
                        </span>
                    )}
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={!allScoresEntered || isSubmitting}
                    className={`px-6 py-2 rounded text-white font-medium transition-colors ${
                        !allScoresEntered 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700'
                    } ${isSubmitting ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Scores'}
                </button>
            </div>

            {!allScoresEntered && (
                <p className="text-sm text-amber-600 text-right">
                    Please score all competitors before submitting
                </p>
            )}
        </div>
    );
};