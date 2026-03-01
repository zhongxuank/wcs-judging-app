import { useState, useEffect } from 'react';
import { competitorAPI } from '../../services/api';
import type { Competitor } from '../../types';
import * as XLSX from 'xlsx';

interface CompetitorImportProps {
    competitionId: string;
    onComplete: (competitors: { leaders: Competitor[]; followers: Competitor[] }) => void;
    onBack: () => void;
}

interface ParsedCompetitor {
    bib: string;
    name: string;
    role: 'leader' | 'follower';
}

type InputMode = 'upload' | 'table';

export const CompetitorImport = ({ competitionId, onComplete, onBack }: CompetitorImportProps) => {
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [inputMode, setInputMode] = useState<InputMode>('upload');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch existing competitors on mount
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const list = await competitorAPI.list({ competition: competitionId });
                if (!cancelled) {
                    setCompetitors(list);
                }
            } catch {
                if (!cancelled) {
                    setError('Failed to load competitors');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [competitionId]);

    const csvToCompetitors = (csvText: string): ParsedCompetitor[] => {
        const lines = csvText.split('\n').filter(line => line.trim());
        const dataLines = lines.slice(1);
        return dataLines.map(line => {
            const [bib, name, role] = line.split(',').map(f => f.trim());
            if (!bib || !name || !role) throw new Error(`Invalid line: ${line}`);
            if (role !== 'leader' && role !== 'follower') throw new Error(`Invalid role: ${role}`);
            return { bib, name, role: role as 'leader' | 'follower' };
        });
    };

    const parseExcelFile = (file: File): Promise<ParsedCompetitor[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { header: 1 });
                    if (rows.length < 2) {
                        reject(new Error('Excel file must have a header row and at least one data row'));
                        return;
                    }
                    const headers = (rows[0] as unknown) as string[];
                    const headerMap: Record<string, number> = {};
                    headers.forEach((h, i) => {
                        const key = String(h || '').trim().toLowerCase().replace(/\s/g, '_');
                        if (key === 'bib' || key === 'bib_number') headerMap.bib = i;
                        else if (key === 'name') headerMap.name = i;
                        else if (key === 'role') headerMap.role = i;
                    });
                    if (!headerMap.bib || headerMap.name === undefined) {
                        reject(new Error('Excel must have bib (or bib_number) and name columns'));
                        return;
                    }
                    const parsed: ParsedCompetitor[] = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i] as unknown as string[];
                        if (!row) continue;
                        const bib = String(row[headerMap.bib] ?? '').trim();
                        const name = String(row[headerMap.name] ?? '').trim();
                        let role = String(row[headerMap.role] ?? '').trim().toLowerCase();
                        if (!bib || !name) continue;
                        if (!role || (role !== 'leader' && role !== 'follower')) {
                            role = i <= (rows.length - 1) / 2 ? 'leader' : 'follower';
                        }
                        parsed.push({ bib, name, role: role as 'leader' | 'follower' });
                    }
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setError(null);
        setImportErrors([]);
        setIsSubmitting(true);

        try {
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                const parsed = csvToCompetitors(text);
                const csvText = 'bib,name,role\n' + parsed.map(p => `${p.bib},${p.name},${p.role}`).join('\n');
                const result = await competitorAPI.importCSV(competitionId, csvText);
                setImportErrors(result.errors || []);
                if (result.competitors?.length) {
                    setCompetitors(prev => {
                        const existingBibs = new Set(prev.map(c => c.bib_number));
                        const newOnes = result.competitors!.filter(c => !existingBibs.has(c.bib_number));
                        return [...prev, ...newOnes];
                    });
                } else if (parsed.length > 0) {
                    setError('Import failed. Please check the file format.');
                }
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                const parsed = await parseExcelFile(file);
                if (parsed.length === 0) {
                    setError('No valid rows found in Excel file');
                } else {
                    const payload = parsed.map(p => ({
                        bib_number: p.bib,
                        name: p.name,
                        role: p.role
                    }));
                    const created = await competitorAPI.bulkCreate(competitionId, payload);
                    setCompetitors(prev => {
                        const existingBibs = new Set(prev.map(c => c.bib_number));
                        const newOnes = created.filter(c => !existingBibs.has(c.bib_number));
                        return [...prev, ...newOnes];
                    });
                }
            } else {
                setError('Please upload a CSV or Excel (.xlsx) file');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import file');
        } finally {
            setIsSubmitting(false);
        }
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
        if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            const input = document.createElement('input');
            input.type = 'file';
            input.files = e.dataTransfer.files;
            const fakeEvent = { target: input } as unknown as React.ChangeEvent<HTMLInputElement>;
            await handleFileUpload(fakeEvent);
        } else {
            setError('Please upload a CSV or Excel (.xlsx) file');
        }
    };

    const handleAddRow = () => {
        setCompetitors(prev => [...prev, {
            id: `new-${Date.now()}`,
            bib_number: '',
            name: '',
            role: 'leader',
            created_at: ''
        } as Competitor]);
        setEditingId(`new-${Date.now()}`);
    };

    const handleUpdateRow = (id: string, field: 'bib_number' | 'name' | 'role', value: string) => {
        setCompetitors(prev => prev.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const handleSaveRow = async (comp: Competitor) => {
        setEditingId(null);
        if (!comp.bib_number?.trim() || !comp.name?.trim()) {
            setCompetitors(prev => prev.filter(c => c.id !== comp.id));
            return;
        }
        const isNew = String(comp.id).startsWith('new-');
        if (isNew) {
            try {
                setIsSubmitting(true);
                const [created] = await competitorAPI.bulkCreate(competitionId, [{
                    bib_number: comp.bib_number.trim(),
                    name: comp.name.trim(),
                    role: comp.role
                }]);
                setCompetitors(prev => prev.map(c => c.id === comp.id ? created : c));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to add competitor');
            } finally {
                setIsSubmitting(false);
            }
        } else {
            try {
                setIsSubmitting(true);
                const updated = await competitorAPI.update(comp.id, {
                    bib_number: comp.bib_number.trim(),
                    name: comp.name.trim(),
                    role: comp.role
                });
                setCompetitors(prev => prev.map(c => c.id === comp.id ? updated : c));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update competitor');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleDeleteRow = async (comp: Competitor) => {
        if (String(comp.id).startsWith('new-')) {
            setCompetitors(prev => prev.filter(c => c.id !== comp.id));
            return;
        }
        try {
            setIsSubmitting(true);
            await competitorAPI.delete(comp.id);
            setCompetitors(prev => prev.filter(c => c.id !== comp.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete competitor');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmList = () => {
        const leaders = competitors.filter(c => c.role === 'leader');
        const followers = competitors.filter(c => c.role === 'follower');
        onComplete({ leaders, followers });
    };

    const getStats = () => {
        const leaders = competitors.filter(c => c.role === 'leader').length;
        const followers = competitors.filter(c => c.role === 'follower').length;
        return { leaders, followers };
    };

    const validCompetitors = competitors.filter(c =>
        c.bib_number?.trim() && c.name?.trim() && (c.role === 'leader' || c.role === 'follower')
    );
    const hasUnsavedNew = competitors.some(c => String(c.id).startsWith('new-'));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-slate-500">Loading competitors...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="section-title">Add / Edit Competitors</h3>
                <p className="mt-1 text-sm text-slate-600">
                    Add via CSV/Excel upload or the table. Bib and name required; role needed for heat logic.
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        inputMode === 'upload' ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    Upload file (CSV / Excel)
                </button>
                <button
                    type="button"
                    onClick={() => setInputMode('table')}
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        inputMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    Add in table
                </button>
            </div>

            {inputMode === 'upload' && (
                <div
                    className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors
                        ${isDragging ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 bg-slate-50/50'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="mb-3 text-4xl">📄</div>
                    <p className="text-sm text-slate-600">Drag & drop CSV or Excel file, or</p>
                    <label className={`mt-2 inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 ${isSubmitting ? 'opacity-50' : ''}`}>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isSubmitting}
                        />
                        {isSubmitting ? 'Importing...' : 'Choose File'}
                    </label>
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                    <button type="button" onClick={() => setError(null)} className="mt-2 text-xs font-medium text-red-600 underline">Dismiss</button>
                </div>
            )}

            {importErrors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h4 className="text-sm font-medium text-amber-900">Import warnings</h4>
                    <ul className="mt-2 list-disc list-inside text-sm text-amber-800">
                        {importErrors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                        {importErrors.length > 5 && <li>...and {importErrors.length - 5} more</li>}
                    </ul>
                </div>
            )}

            {competitors.length > 0 && (
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="section-title">Competitor list ({competitors.length})</h4>
                        <span className="text-sm text-slate-500">Leaders: {getStats().leaders} · Followers: {getStats().followers}</span>
                    </div>
                    <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="sticky top-0 bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Bib #</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Role</th>
                                    <th className="px-4 py-3 w-20" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {competitors.map((comp) => (
                                    <tr key={comp.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={comp.bib_number || ''}
                                                onChange={(e) => handleUpdateRow(comp.id, 'bib_number', e.target.value)}
                                                onBlur={() => editingId === comp.id && handleSaveRow(comp)}
                                                onFocus={() => setEditingId(comp.id)}
                                                placeholder="Bib"
                                                className="input-base w-20 py-2"
                                                disabled={isSubmitting}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={comp.name || ''}
                                                onChange={(e) => handleUpdateRow(comp.id, 'name', e.target.value)}
                                                onBlur={() => editingId === comp.id && handleSaveRow(comp)}
                                                onFocus={() => setEditingId(comp.id)}
                                                placeholder="Name"
                                                className="input-base min-w-[120px] py-2"
                                                disabled={isSubmitting}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={comp.role || 'leader'}
                                                onChange={(e) => handleUpdateRow(comp.id, 'role', e.target.value)}
                                                onBlur={() => editingId === comp.id && handleSaveRow(comp)}
                                                className="input-base w-28 py-2"
                                                disabled={isSubmitting}
                                            >
                                                <option value="leader">Leader</option>
                                                <option value="follower">Follower</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRow(comp)}
                                                disabled={isSubmitting}
                                                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddRow}
                        disabled={isSubmitting || hasUnsavedNew}
                        className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                    >
                        + Add row
                    </button>
                </div>
            )}

            {inputMode === 'table' && competitors.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                    <p className="text-sm text-slate-600">No competitors yet.</p>
                    <button type="button" onClick={handleAddRow} className="btn-primary mt-3">
                        + Add first competitor
                    </button>
                </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
                <button onClick={onBack} disabled={isSubmitting} className="btn-secondary">
                    Back
                </button>
                <button
                    onClick={handleConfirmList}
                    disabled={validCompetitors.length === 0 || isSubmitting || hasUnsavedNew}
                    className="btn-primary disabled:bg-slate-300 disabled:hover:bg-slate-300"
                >
                    Confirm competitor list & continue
                </button>
            </div>
        </div>
    );
};
