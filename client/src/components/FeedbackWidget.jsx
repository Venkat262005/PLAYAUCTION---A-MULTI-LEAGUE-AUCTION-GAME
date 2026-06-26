import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

const categories = [
    { value: 'bug', label: 'Bug' },
    { value: 'improvement', label: 'Improvement' },
    { value: 'feature', label: 'Feature' },
    { value: 'general', label: 'General' },
];

const FeedbackWidget = () => {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [category, setCategory] = useState('improvement');
    const [message, setMessage] = useState('');
    const [contact, setContact] = useState('');

    const location = useLocation();
    const { playerName, userId } = useSession();
    const apiUrl = import.meta.env.VITE_API_URL || '';

    const inferredLeague = useMemo(() => {
        const path = location.pathname.toLowerCase();
        if (path.includes('/auction/')) return 'ipl';
        if (path.includes('/quiz/')) return 'quiz';
        return sessionStorage.getItem('selectedLeague') || 'ipl';
    }, [location.pathname]);

    useEffect(() => {
        if (!open) return;
        setSuccess('');
        setError('');
    }, [open]);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(''), 2500);
        return () => clearTimeout(timer);
    }, [success]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) {
            setError('Please write a feedback message.');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const response = await fetch(`${apiUrl}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: playerName || sessionStorage.getItem('playerName') || 'Anonymous',
                    userId,
                    playerName: playerName || null,
                    roomCode: location.pathname.match(/\/(auction|quiz|results|evaluating)\/([^/]+)/)?.[2] || null,
                    league: inferredLeague,
                    page: location.pathname,
                    category,
                    message: trimmed,
                    contact: contact.trim(),
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to send feedback');

            setMessage('');
            setContact('');
            setCategory('improvement');
            setOpen(false);
            setSuccess('Feedback sent to admin.');
        } catch (err) {
            setError(err.message || 'Could not send feedback.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.95 }}
                        className="fixed bottom-24 right-4 z-[1005] max-w-xs rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200 shadow-2xl backdrop-blur-xl"
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest">Thanks</div>
                        <div className="text-sm font-semibold">{success}</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed bottom-4 right-4 z-[1004] group flex items-center gap-2 rounded-full border border-violet-500/20 bg-[#0c0a18]/90 px-4 py-3 text-violet-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-[#111024]"
                aria-label="Open feedback form"
            >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.25em]">
                    Feedback
                </span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1006] flex items-end justify-end p-4 sm:p-6 bg-black/45 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 24, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.96 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0c0a18]/95 p-5 sm:p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
                        >
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-[0.35em] text-violet-300/70">Admin Feedback</div>
                                    <h3 className="text-lg font-black text-white">Tell us what to fix</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
                                    aria-label="Close feedback form"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    {categories.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setCategory(item.value)}
                                            className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                category === item.value
                                                    ? 'border-violet-400/50 bg-violet-500/15 text-violet-100'
                                                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Describe the issue, suggestion, or improvement..."
                                    rows={5}
                                    className="w-full rounded-2xl border border-white/10 bg-[#10111b]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-400/60"
                                />

                                <input
                                    type="text"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    placeholder="Optional contact / note for admin"
                                    className="w-full rounded-2xl border border-white/10 bg-[#10111b]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-400/60"
                                />

                                {error && (
                                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">
                                        {error}
                                    </div>
                                )}

                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <div className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                                        Sent to admin inbox
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-blue-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Send
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FeedbackWidget;
