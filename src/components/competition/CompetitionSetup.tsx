import { useState } from 'react';
import { competitionAPI } from '../../services/api';
import type { Competition, Judge, Competitor, JudgeFormState } from '../../types';
import { JudgeAssignment } from './JudgeAssignment';
import { CompetitorImport } from './CompetitorImport';
import { RoundHeatsConfig } from './RoundHeatsConfig';

type SetupStep = 'basic' | 'import_details' | 'judges' | 'competitors' | 'rounds' | 'ready';

interface CompetitionSetupProps {
    onComplete?: (competition: Competition) => void;
}

export const CompetitionSetup = ({ onComplete }: CompetitionSetupProps) => {
    const [currentStep, setCurrentStep] = useState<SetupStep>('basic');
    const [competition, setCompetition] = useState<Partial<Competition>>({
        id: crypto.randomUUID(),
        status: 'setup'
    });
    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [chiefJudge, setChiefJudge] = useState<JudgeFormState>({
        id: crypto.randomUUID(),
        name: '',
        is_chief_judge: true,
        assigned_role: 'both'
    });
    const [competitionStyle, setCompetitionStyle] = useState<'prelim' | 'finals'>('prelim');
    const [judgeCount, setJudgeCount] = useState<number>(3);
    const [isImportPrelims, setIsImportPrelims] = useState(false);

    const prelimJudgeCounts = [3, 4, 5, 6, 7] as const;
    const finalsJudgeCounts = [3, 5, 7] as const;
    const judgeCountOptions = competitionStyle === 'finals' ? finalsJudgeCounts : prelimJudgeCounts;

    const handleCompetitionStyleChange = (style: 'prelim' | 'finals') => {
        setCompetitionStyle(style);
        if (style === 'finals' && (judgeCount === 4 || judgeCount === 6)) {
            setJudgeCount(3);
        }
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleBasicInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Create competition via API
            const created = await competitionAPI.create({
                name: competition.name!,
                date: competition.date!,
                chief_judge_name: chiefJudge.name
            });

            setCompetitionId(created.id);
            setCompetition(prev => ({
                ...prev,
                ...created
            }));
            // If importing from prelims, go to import details first; otherwise go to judges
            setCurrentStep(isImportPrelims ? 'import_details' : 'judges');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create competition');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJudgeAssignment = (judges: { leaders: Judge[]; followers: Judge[] }) => {
        if (!competitionId) return;

        // Judges are already created via JudgeAssignment; just update local state
        setCompetition(prev => ({
            ...prev,
            judges: [...judges.leaders, ...judges.followers]
        }));
        setCurrentStep('competitors');
    };

    const handleCompetitorImport = async (competitors: { leaders: Competitor[], followers: Competitor[] }) => {
        if (!competitionId) return;

        setCompetition(prev => ({
            ...prev,
            competitors: [...competitors.leaders, ...competitors.followers]
        }));
        setCurrentStep('rounds');
    };

    const handleReady = async () => {
        if (!competitionId) return;
        setCurrentStep('ready');
        try {
            const fullCompetition = await competitionAPI.get(competitionId);
            if (onComplete) {
                onComplete(fullCompetition);
            }
        } catch {
            // Ignore - we're at ready step regardless
        }
    };

    const allSteps = (): { key: SetupStep; label: string; icon: string }[] => {
        const base = [
            { key: 'basic' as SetupStep, label: 'Basic Info', icon: '📋' },
            ...(isImportPrelims ? [{ key: 'import_details' as SetupStep, label: 'Import Details', icon: '📥' }] : []),
            { key: 'judges' as SetupStep, label: 'Judges', icon: '👥' },
            { key: 'competitors' as SetupStep, label: 'Competitors', icon: '🎭' },
            { key: 'rounds' as SetupStep, label: 'Round & Heats', icon: '🎯' },
            { key: 'ready' as SetupStep, label: 'Ready', icon: '✅' },
        ];
        return base;
    };

    const renderStepIndicator = () => {
        const steps = allSteps();

        // Mobile step indicator
        const renderMobileSteps = () => (
            <div className="sm:hidden">
                <div className="mb-4 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-indigo-500 bg-indigo-50 text-2xl">
                        {steps.find(s => s.key === currentStep)?.icon}
                    </div>
                </div>
                <p className="text-center text-sm font-medium text-indigo-600">
                    Step {getStepNumber(currentStep)} of {steps.length}: {steps.find(s => s.key === currentStep)?.label}
                </p>
            </div>
        );

        // Desktop step indicator
        const renderDesktopSteps = () => (
            <div className="hidden sm:block">
                <div className="flex items-center">
                    {steps.map((step, index) => {
                        const isActive = currentStep === step.key;
                        const isComplete = getStepNumber(step.key) < getStepNumber(currentStep);
                        return (
                            <div key={step.key} className="flex flex-1 items-center">
                                <div className={`flex flex-col items-center ${isActive ? 'text-indigo-600' : isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                        isActive ? 'border-indigo-500 bg-indigo-50' : isComplete ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                                    }`}>
                                        {isComplete ? <span className="text-sm font-semibold">✓</span> : <span className="text-base">{step.icon}</span>}
                                    </div>
                                    <span className="mt-1.5 text-xs font-medium">{step.label}</span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`mx-1 h-0.5 flex-1 ${isComplete ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        return (
            <div className="mb-8">
                {renderMobileSteps()}
                {renderDesktopSteps()}
            </div>
        );
    };

    const renderBasicInfo = () => (
        <form onSubmit={handleBasicInfoSubmit} className="space-y-6">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}
            <div className="space-y-2">
                <label htmlFor="competitionName" className="label">Competition Name</label>
                <input
                    type="text"
                    id="competitionName"
                    value={competition.name || ''}
                    onChange={(e) => setCompetition((prev: Partial<Competition>) => ({ ...prev, name: e.target.value }))}
                    className="input-base"
                    required
                    disabled={isSubmitting}
                />
            </div>
            <div>
                <span className="label mb-3 block">Competition Style</span>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-white/60">
                        <input
                            type="radio"
                            name="compStyle"
                            checked={competitionStyle === 'prelim'}
                            onChange={() => handleCompetitionStyleChange('prelim')}
                            disabled={isSubmitting}
                            className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Preliminaries</span>
                        <span className="text-xs text-slate-500">— Any number of judges per role</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-white/60">
                        <input
                            type="radio"
                            name="compStyle"
                            checked={competitionStyle === 'finals'}
                            onChange={() => handleCompetitionStyleChange('finals')}
                            disabled={isSubmitting}
                            className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Finals</span>
                        <span className="text-xs text-slate-500">— Odd number of judges required (3, 5, or 7)</span>
                    </label>
                </div>
            </div>
            <div>
                <span className="label mb-3 block">Competition Type</span>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-white/60">
                        <input
                            type="radio"
                            name="compType"
                            checked={!isImportPrelims}
                            onChange={() => setIsImportPrelims(false)}
                            disabled={isSubmitting}
                            className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Fresh competition</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-white/60">
                        <input
                            type="radio"
                            name="compType"
                            checked={isImportPrelims}
                            onChange={() => setIsImportPrelims(true)}
                            disabled={isSubmitting}
                            className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Import results from previous prelims</span>
                    </label>
                </div>
            </div>
            <div>
                <span className="label mb-3 block">Number of Judges per Role</span>
                <div className="flex flex-wrap gap-2">
                    {judgeCountOptions.map((count) => (
                        <button
                            key={count}
                            type="button"
                            onClick={() => setJudgeCount(count)}
                            disabled={isSubmitting}
                            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                judgeCount === count
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            } disabled:opacity-50`}
                        >
                            {count}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                    {judgeCount} judges per role ({judgeCount * 2} total, plus chief judge)
                    {competitionStyle === 'finals' && ' — odd number required for tie-breaking'}
                </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="eventDate" className="label">Event Date</label>
                    <input
                        type="date"
                        id="eventDate"
                        value={competition.date || ''}
                        onChange={(e) => setCompetition((prev: Partial<Competition>) => ({ ...prev, date: e.target.value }))}
                        className="input-base"
                        required
                        disabled={isSubmitting}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="chiefJudge" className="label">Chief Judge Name</label>
                    <input
                        type="text"
                        id="chiefJudge"
                        value={chiefJudge.name}
                        onChange={(e) => setChiefJudge((prev) => ({ ...prev, name: e.target.value }))}
                        className="input-base"
                        required
                        disabled={isSubmitting}
                    />
                </div>
            </div>
            <div className="pt-2">
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                    {isSubmitting ? 'Saving...' : isImportPrelims ? 'Next: Import Details' : 'Next: Judges'}
                </button>
            </div>
        </form>
    );

    const handleImportDetailsComplete = () => {
        setCurrentStep('judges');
    };

    const renderImportDetails = () => (
        <div className="space-y-6">
            <h3 className="section-title">Import Details</h3>
            <p className="text-sm text-slate-600">
                When importing from previous prelims, you can configure heat structure and import the advancing competitor list in the next steps.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-5">
                <p className="text-sm text-slate-600">
                    Continue to set up judges and import competitors. Heat configuration will be done after the competitor list is confirmed.
                </p>
            </div>
            <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCurrentStep('basic')} className="btn-secondary">
                    Back
                </button>
                <button type="button" onClick={handleImportDetailsComplete} className="btn-primary">
                    Next: Judges
                </button>
            </div>
        </div>
    );

    const getStepNumber = (step: SetupStep): number => {
        const steps = allSteps().map(s => s.key);
        const idx = steps.indexOf(step);
        return idx >= 0 ? idx + 1 : 0;
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Competition Setup</h1>
                <p className="mt-1 text-slate-600">Configure your competition settings step by step</p>
            </div>
            {renderStepIndicator()}
            {error && currentStep !== 'basic' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}
            <div className="border-t border-slate-200 pt-8">
                {currentStep === 'basic' && renderBasicInfo()}
                {currentStep === 'import_details' && renderImportDetails()}
                {currentStep === 'judges' && competitionId && (
                    <JudgeAssignment
                        chiefJudge={chiefJudge}
                        competitionId={competitionId}
                        initialJudgeCount={judgeCount}
                        onComplete={handleJudgeAssignment}
                        onBack={() => setCurrentStep(isImportPrelims ? 'import_details' : 'basic')}
                        isSubmitting={isSubmitting}
                    />
                )}
                {currentStep === 'competitors' && competitionId && (
                    <CompetitorImport
                        competitionId={competitionId}
                        onComplete={handleCompetitorImport}
                        onBack={() => setCurrentStep('judges')}
                    />
                )}
                {currentStep === 'rounds' && competitionId && (
                    <RoundHeatsConfig
                        competitionId={competitionId}
                        onComplete={handleReady}
                        onBack={() => setCurrentStep('competitors')}
                    />
                )}
                {currentStep === 'ready' && competitionId && (
                    <div className="py-12 text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
                        <h3 className="text-xl font-semibold text-emerald-700">Competition Ready to Judge!</h3>
                        <p className="mt-2 text-slate-600">
                            Competition setup is complete. You can now proceed to manage rounds and scoring.
                        </p>
                        <button onClick={() => window.location.reload()} className="btn-primary mt-6">
                            Start Over
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};