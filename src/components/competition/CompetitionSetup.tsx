import { useState } from 'react';
import { competitionAPI, judgeAPI } from '../../services/api';
import type { Competition, Judge, Competitor } from '../../types';
import { JudgeAssignment } from './JudgeAssignment';
import { CompetitorImport } from './CompetitorImport';

type SetupStep = 'basic' | 'judges' | 'competitors' | 'rounds';

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
    const [chiefJudge, setChiefJudge] = useState<Judge>({
        id: crypto.randomUUID(),
        name: '',
        is_chief_judge: true,
        assigned_role: 'both'
    });
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
            setCurrentStep('judges');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create competition');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJudgeAssignment = async (judges: { leaders: Judge[], followers: Judge[] }) => {
        if (!competitionId) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Combine all judges including chief judge
            const allJudges = [
                ...judges.leaders,
                ...judges.followers
            ];

            // Create judges via API
            await judgeAPI.bulkCreate(competitionId, allJudges);

            setCompetition(prev => ({
                ...prev,
                judges: { leaders: judges.leaders, followers: judges.followers }
            }));
            setCurrentStep('competitors');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save judges');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompetitorImport = async (competitors: { leaders: Competitor[], followers: Competitor[] }) => {
        if (!competitionId) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Competitors are already imported via the CompetitorImport component
            setCompetition(prev => ({
                ...prev,
                competitors: { leaders: competitors.leaders, followers: competitors.followers }
            }));
            setCurrentStep('rounds');
            
            // Fetch the full competition data
            const fullCompetition = await competitionAPI.get(competitionId);
            
            if (onComplete) {
                onComplete(fullCompetition);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete setup');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepIndicator = () => {
        const steps: { key: SetupStep; label: string; icon: string }[] = [
            { key: 'basic', label: 'Basic Info', icon: '📋' },
            { key: 'judges', label: 'Judge Assignment', icon: '👥' },
            { key: 'competitors', label: 'Competitors', icon: '🎭' },
            { key: 'rounds', label: 'Round Setup', icon: '🎯' },
        ];

        // Mobile step indicator
        const renderMobileSteps = () => (
            <div className="sm:hidden">
                <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center
                        border-indigo-600 bg-indigo-50">
                        <span className="text-2xl">{steps.find(s => s.key === currentStep)?.icon}</span>
                    </div>
                </div>
                <p className="text-center text-sm font-medium text-indigo-600 mb-4">
                    Step {getStepNumber(currentStep)} of {steps.length}: {steps.find(s => s.key === currentStep)?.label}
                </p>
            </div>
        );

        // Desktop step indicator
        const renderDesktopSteps = () => (
            <div className="hidden sm:block">
                <div className="flex justify-between items-center">
                    {steps.map((step, index) => (
                        <div key={step.key} className="flex-1 relative">
                            <div className={`
                                flex flex-col items-center
                                ${currentStep === step.key ? 'text-indigo-600' : 
                                  getStepNumber(step.key) < getStepNumber(currentStep) ? 'text-green-600' : 'text-gray-400'}
                            `}>
                                <div className={`
                                    w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2
                                    ${currentStep === step.key ? 'border-indigo-600 bg-indigo-50' :
                                      getStepNumber(step.key) < getStepNumber(currentStep) ? 'border-green-600 bg-green-50' : 'border-gray-300'}
                                `}>
                                    {getStepNumber(step.key) < getStepNumber(currentStep) ? (
                                        <span className="text-green-600">✓</span>
                                    ) : (
                                        <span className="text-xl">{step.icon}</span>
                                    )}
                                </div>
                                <span className="text-sm font-medium">{step.label}</span>
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`
                                    absolute top-5 left-1/2 w-full h-0.5
                                    ${getStepNumber(step.key) < getStepNumber(currentStep) ? 'bg-green-600' : 'bg-gray-200'}
                                `} />
                            )}
                        </div>
                    ))}
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}
            <div>
                <label htmlFor="competitionName" className="block text-sm font-medium text-gray-700">
                    Competition Name
                </label>
                <input
                    type="text"
                    id="competitionName"
                    value={competition.name || ''}
                    onChange={(e) => setCompetition((prev: Partial<Competition>) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                    disabled={isSubmitting}
                />
            </div>
            <div>
                <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700">
                    Event Date
                </label>
                <input
                    type="date"
                    id="eventDate"
                    value={competition.date || ''}
                    onChange={(e) => setCompetition((prev: Partial<Competition>) => ({ ...prev, date: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                    disabled={isSubmitting}
                />
            </div>
            <div>
                <label htmlFor="chiefJudge" className="block text-sm font-medium text-gray-700">
                    Chief Judge Name
                </label>
                <input
                    type="text"
                    id="chiefJudge"
                    value={chiefJudge.name}
                    onChange={(e) => setChiefJudge((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                    disabled={isSubmitting}
                />
            </div>
            <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isSubmitting ? 'Saving...' : 'Next: Judge Assignment'}
            </button>
        </form>
    );

    const getStepNumber = (step: SetupStep): number => {
        const steps: SetupStep[] = ['basic', 'judges', 'competitors', 'rounds'];
        return steps.indexOf(step) + 1;
    };

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Competition Setup
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-8">Configure your competition settings step by step</p>
            {renderStepIndicator()}
            {error && currentStep !== 'basic' && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}
            <div className="bg-white rounded-xl p-4 sm:p-6">
                {currentStep === 'basic' && renderBasicInfo()}
                {currentStep === 'judges' && competitionId && (
                    <JudgeAssignment
                        chiefJudge={chiefJudge}
                        competitionId={competitionId}
                        onComplete={handleJudgeAssignment}
                        onBack={() => setCurrentStep('basic')}
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
                    <div className="text-center py-8">
                        <h3 className="text-xl font-semibold text-green-600 mb-4">Setup Complete!</h3>
                        <p className="text-gray-600 mb-4">
                            Competition setup is complete. You can now proceed to manage rounds and scoring.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                        >
                            Start Over
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};