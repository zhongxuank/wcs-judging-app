import { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-14 items-center">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
                                <span className="text-sm font-bold text-white">W</span>
                            </div>
                            <span className="text-lg font-semibold text-slate-800">
                                WCS Judging
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8 md:p-10">
                    {children}
                </div>
            </main>

            <footer className="mt-12 border-t border-slate-200/60 bg-white/50 py-4">
                <div className="mx-auto max-w-4xl px-4 text-center text-xs text-slate-500 sm:px-6">
                    West Coast Swing Competition Management System
                </div>
            </footer>
        </div>
    );
};
