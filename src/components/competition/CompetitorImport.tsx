import { useState } from 'react';
import { competitorAPI } from '../../services/api';
import type { Competitor } from '../../types';

interface CompetitorImportProps {
    competitionId: string;
    onComplete: (competitors: { leaders: Competitor[], followers: Competitor[] }) => void;
    onBack: () => void;
}

interface ParsedCompetitor {
    bib: string;
    name: string;
    role: 'leader' | 'follower';
}

export const CompetitorImport = ({ competitionId, onComplete, onBack }: CompetitorImportProps) => {
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            parseAndUploadCSV(text);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to read file');
            setCompetitors([]);
        }
    };

    const parseAndUploadCSV = async (csvText: string) => {
        setError(null);
        setImportErrors([]);
        setIsSubmitting(true);

        try {
            // First validate the CSV locally
            const lines = csvText.split('\n');
            
            // Remove header row and empty lines
            const dataLines = lines.slice(1).filter(line => line.trim());
            
            const parsedCompetitors: ParsedCompetitor[] = dataLines.map(line => {
                const [bib, name, role] = line.split(',').map(field => field.trim());
                if (!bib || !name || !role) {
                    throw new Error(`Invalid line format: ${line}`);
                }
                if (role !== 'leader' && role !== 'follower') {
                    throw new Error(`Invalid role '${role}' for competitor ${name}`);
                }
                return { bib, name, role: role as 'leader' | 'follower' };
            });

            // Validate bib numbers
            const bibNumbers = new Set<string>();
            parsedCompetitors.forEach(comp => {
                if (bibNumbers.has(comp.bib)) {
                    throw new Error(`Duplicate bib number: ${comp.bib}`);
                }
                bibNumbers.add(comp.bib);
            });

            // Send to API
            const result = await competitorAPI.importCSV(competitionId, csvText);
            
            setImportErrors(result.errors || []);
            
            if (result.competitors && result.competitors.length > 0) {
                // API response matches local type (both use snake_case)
                setCompetitors(result.competitors);
            } else {
                setError('No competitors were imported. Please check the CSV format.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
            setCompetitors([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = () => {
        const leaders = competitors.filter(c => c.role === 'leader');
        const followers = competitors.filter(c => c.role === 'follower');
        onComplete({ leaders, followers });
    };

    const getStats = () => {
        const leaders = competitors.filter(c => c.role === 'leader').length;
        const followers = competitors.filter(c => c.role === 'follower').length;
        return { leaders, followers };
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            try {
                const text = await file.text();
                parseAndUploadCSV(text);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to read file');
            }
        } else {
            setError('Please upload a CSV file');
        }
    };

    return (
        <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Import Competitors</h3>
            
            {/* File Upload Section */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-4 sm:p-8 mb-6 text-center
                    ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
                    transition-colors duration-200 ease-in-out
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center">
                    <div className="text-3xl sm:text-4xl mb-2">📄</div>
                    <p className="text-sm sm:text-base text-gray-600 mb-2">
                        Drag & drop your CSV file here, or
                    </p>
                    <label className={`cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isSubmitting}
                        />
                        {isSubmitting ? 'Importing...' : 'Choose File'}
                    </label>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm sm:text-base text-red-600">{error}</p>
                </div>
            )}

            {/* Import Errors from API */}
            {importErrors.length > 0 && (
                <div className="mb-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">Import Warnings:</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700">
                        {importErrors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Import Summary */}
            {competitors.length > 0 && (
                <div className="mb-6">
                    <h4 className="text-base sm:text-lg font-medium mb-2">Import Summary</h4>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                        <p className="text-sm sm:text-base text-gray-600">
                            Successfully imported {competitors.length} competitors
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            Leaders: {getStats().leaders} | Followers: {getStats().followers}
                        </p>
                    </div>
                </div>
            )}

            {/* Competitors Table */}
            {competitors.length > 0 && (
                <div className="overflow-x-auto mb-6 max-h-64">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500">Bib #</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500">Name</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500">Role</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {competitors.map((competitor, index) => (
                                <tr key={competitor.id || index}>
                                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900">#{competitor.bib_number}</td>
                                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900">{competitor.name}</td>
                                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900">
                                        <span className={`
                                            inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                                            ${competitor.role === 'leader' 
                                                ? 'bg-blue-100 text-blue-800' 
                                                : 'bg-pink-100 text-pink-800'
                                            }
                                        `}>
                                            {competitor.role}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <button
                    onClick={onBack}
                    disabled={isSubmitting}
                    className="order-2 sm:order-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    Back
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={competitors.length === 0 || isSubmitting}
                    className={`
                        order-1 sm:order-2 px-4 py-2 text-sm rounded-md text-white
                        ${competitors.length === 0 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700'}
                        transition-colors
                    `}
                >
                    Continue
                </button>
            </div>
        </div>
    );
};