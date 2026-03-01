import { useState, useEffect } from 'react';
import { roundAPI, competitorAPI } from '../../services/api';
import type { Round, Competitor } from '../../types';

interface RoundHeatsConfigProps {
    competitionId: string;
    onComplete: () => void;
    onBack: () => void;
}

export const RoundHeatsConfig = ({ competitionId, onComplete, onBack }: RoundHeatsConfigProps) => {
    const [heatSize, setHeatSize] = useState(6);
    const [requiredYesCount, setRequiredYesCount] = useState(3);
    const [alternateCount, setAlternateCount] = useState<2 | 3>(2);
    const [numHeatsOverride, setNumHeatsOverride] = useState<string>('');
    const [round, setRound] = useState<Round | null>(null);
    const [heatsGenerated, setHeatsGenerated] = useState(false);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [repeatSummary, setRepeatSummary] = useState<{ leaders_repeating?: number; followers_repeating?: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [roundsList, compList] = await Promise.all([
                    roundAPI.list(competitionId),
                    competitorAPI.list({ competition: competitionId })
                ]);
                if (!cancelled) {
                    const prelim = roundsList.find(r => r.round_type === 'preliminary');
                    setRound(prelim ?? null);
                    setCompetitors(compList);
                    if (prelim && (prelim.heat_count ?? 0) > 0) {
                        setHeatsGenerated(true);
                    }
                }
            } catch {
                if (!cancelled) setError('Failed to load data');
            }
        };
        load();
        return () => { cancelled = true; };
    }, [competitionId]);

    const leaders = competitors.filter(c => c.role === 'leader').length;
    const followers = competitors.filter(c => c.role === 'follower').length;
    const suggestedHeats = Math.max(
        Math.ceil(leaders / heatSize),
        Math.ceil(followers / heatSize)
    );

    const handleCreateRoundAndHeats = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            let roundId: string;
            if (round) {
                roundId = round.id;
                await roundAPI.update(roundId, {
                    heat_size: heatSize,
                    required_yes_count: requiredYesCount,
                    alternate_count: alternateCount
                });
            } else {
                const created = await roundAPI.create({
                    competition: competitionId,
                    number: 1,
                    round_type: 'preliminary',
                    heat_size: heatSize,
                    required_yes_count: requiredYesCount,
                    alternate_count: alternateCount
                });
                roundId = created.id;
                setRound(created);
            }
            const numHeats = numHeatsOverride && /^\d+$/.test(numHeatsOverride)
                ? parseInt(numHeatsOverride, 10)
                : undefined;
            const result = await roundAPI.generateHeats(roundId, heatSize, numHeats);
            setRepeatSummary(result.repeat_summary ?? null);
            if (result.created > 0) {
                setRound(await roundAPI.get(roundId));
                setHeatsGenerated(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to configure heats');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleComplete = () => {
        onComplete();
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="section-title">Round & Heats Configuration</h3>
                <p className="mt-1 text-sm text-slate-600">
                    Set heat size, number of heats, and how many Yes votes and alternates judges must provide.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <span className="label mb-1 block">Competitor counts</span>
                    <p className="text-sm text-slate-600">Leaders: {leaders} · Followers: {followers}</p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="heatSize" className="label">Couples per heat</label>
                    <input
                        id="heatSize"
                        type="number"
                        min={3}
                        max={20}
                        value={heatSize}
                        onChange={(e) => setHeatSize(Math.max(3, Math.min(20, parseInt(e.target.value, 10) || 6)))}
                        className="input-base w-24"
                        disabled={isSubmitting}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="numHeats" className="label">Number of heats (optional)</label>
                    <input
                        id="numHeats"
                        type="text"
                        placeholder={`Auto: ${suggestedHeats}`}
                        value={numHeatsOverride}
                        onChange={(e) => setNumHeatsOverride(e.target.value)}
                        className="input-base w-32"
                        disabled={isSubmitting}
                    />
                    <p className="text-xs text-slate-500">Leave empty to auto-calculate.</p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="requiredYes" className="label">Yes votes required to advance</label>
                    <input
                        id="requiredYes"
                        type="number"
                        min={1}
                        max={10}
                        value={requiredYesCount}
                        onChange={(e) => setRequiredYesCount(Math.max(1, parseInt(e.target.value, 10) || 3))}
                        className="input-base w-24"
                        disabled={isSubmitting}
                    />
                </div>

                <div className="sm:col-span-2">
                    <span className="label mb-3 block">Alternates per judge</span>
                    <div className="flex gap-2">
                        {([2, 3] as const).map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setAlternateCount(n)}
                                disabled={isSubmitting}
                                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                    alternateCount === n ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {repeatSummary && (repeatSummary.leaders_repeating || repeatSummary.followers_repeating) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                    <h4 className="text-sm font-medium text-amber-900">Role mismatch – repeat dancers</h4>
                    <p className="mt-1 text-sm text-amber-800">
                        {repeatSummary.leaders_repeating && <span>{repeatSummary.leaders_repeating} leader(s) will repeat. </span>}
                        {repeatSummary.followers_repeating && <span>{repeatSummary.followers_repeating} follower(s) will repeat.</span>}
                    </p>
                </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
                <button type="button" onClick={onBack} disabled={isSubmitting} className="btn-secondary">
                    Back
                </button>
                <button
                    type="button"
                    onClick={handleCreateRoundAndHeats}
                    disabled={isSubmitting || leaders === 0 || followers === 0}
                    className="btn-primary"
                >
                    {isSubmitting ? 'Generating...' : 'Generate heats'}
                </button>
                {heatsGenerated && (
                    <button type="button" onClick={handleComplete} disabled={isSubmitting} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                        Competition ready to judge
                    </button>
                )}
            </div>
        </div>
    );
};
