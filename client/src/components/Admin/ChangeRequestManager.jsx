import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GitPullRequest, CheckCircle2, XCircle, Clock, AlertTriangle,
    Eye, Trash2, Send, Plus, ArrowRight, ShieldCheck, User,
    Calendar, Database, Layers, Check, X, FileText, ChevronRight,
    RefreshCw, Filter, Sparkles, MessageSquare, History, Award,
    CheckCheck, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

const ChangeRequestManager = ({
    token,
    API_URL,
    userRole = 'admin',
    currentUser = '',
    onActiveDraftUpdated
}) => {
    const [workspaces, setWorkspaces] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedHistoryEditor, setSelectedHistoryEditor] = useState(null);
    const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'ACTIVE' | 'IDLE'
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [itemApprovals, setItemApprovals] = useState({}); // { [itemId]: boolean }
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);

    const isEditor = userRole === 'editor';

    // 1. Fetch Consolidated Workspaces (One working card per editor + contribution history)
    const fetchWorkspaces = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/change-requests/workspaces`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setWorkspaces(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch workspaces:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    // 2. Open Diff Inspector for any request (active draft or past approved batch)
    const openRequestDetails = async (id) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/change-requests/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setSelectedRequest(data);
                setAdminNotes(data.adminNotes || '');
                // Default all items to approved in partial selection
                const initialMap = {};
                (data.items || []).forEach(item => {
                    initialMap[item._id] = item.status !== 'REJECTED';
                });
                setItemApprovals(initialMap);
            }
        } catch (err) {
            console.error('Failed to load request details:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // 3. Create a manual batch
    const handleCreateBatch = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/change-requests/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    description: newDesc.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                setShowNewModal(false);
                setNewTitle('');
                setNewDesc('');
                await fetchWorkspaces();
                if (onActiveDraftUpdated) onActiveDraftUpdated();
                setActionMessage({ type: 'success', text: `Created new draft batch "${data.title}"` });
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Failed to create batch' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Error creating batch: ' + err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    // 4. Editor submits their draft for Admin approval
    const handleSubmitForReview = async (requestId) => {
        if (!window.confirm('Submit this draft to the Admin for approval? You will be able to start new edits once approved.')) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/change-requests/${requestId}/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (res.ok) {
                setActionMessage({ type: 'success', text: 'Draft successfully submitted for Admin approval!' });
                await fetchWorkspaces();
                if (selectedRequest && selectedRequest._id === requestId) {
                    setSelectedRequest(data.request);
                }
                if (onActiveDraftUpdated) onActiveDraftUpdated();
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Failed to submit request' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Submit failed: ' + err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    // 5. Admin Reviews and Approves/Merges or Rejects
    const handleAdminReview = async (requestId, decision) => {
        const targetId = requestId || selectedRequest?._id;
        if (!targetId) return;

        const confirmMsg = decision === 'APPROVE'
            ? 'Are you sure you want to approve and merge these changes directly into the primary database?'
            : decision === 'REJECT'
            ? 'Are you sure you want to reject this change request?'
            : 'Merge selected items into the primary database?';

        if (!window.confirm(confirmMsg)) return;

        setIsProcessing(true);
        try {
            const itemDecisions = {};
            Object.keys(itemApprovals).forEach(id => {
                itemDecisions[id] = itemApprovals[id] ? 'APPROVED' : 'REJECTED';
            });

            const res = await fetch(`${API_URL}/api/admin/change-requests/${targetId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    decision,
                    adminNotes,
                    itemDecisions
                })
            });

            const data = await res.json();
            if (res.ok) {
                setActionMessage({ type: 'success', text: data.message });
                setSelectedRequest(null);
                await fetchWorkspaces();
                if (onActiveDraftUpdated) onActiveDraftUpdated();
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Review failed' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Review failed: ' + err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    // 6. Discard draft
    const handleDiscardDraft = async (requestId) => {
        if (!window.confirm('Are you sure you want to permanently discard this draft session?')) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/change-requests/${requestId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setActionMessage({ type: 'success', text: 'Draft discarded successfully' });
                if (selectedRequest && selectedRequest._id === requestId) {
                    setSelectedRequest(null);
                }
                await fetchWorkspaces();
                if (onActiveDraftUpdated) onActiveDraftUpdated();
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Discard failed: ' + err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    // 7. Remove single item from draft
    const handleRemoveItem = async (requestId, itemId) => {
        if (!window.confirm('Remove this item from the staged draft?')) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/change-requests/${requestId}/items/${itemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setSelectedRequest(data.request);
                await fetchWorkspaces();
                if (onActiveDraftUpdated) onActiveDraftUpdated();
            }
        } catch (err) {
            console.error('Failed to remove item:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Filter workspaces based on active filterTab
    const filteredWorkspaces = workspaces.filter(ws => {
        const draftItemsCount = ws.activeDraft?.items?.length || 0;
        const isPending = ws.activeDraft?.status === 'PENDING_REVIEW';
        if (filterTab === 'PENDING') return isPending;
        if (filterTab === 'ACTIVE') return draftItemsCount > 0;
        if (filterTab === 'IDLE') return draftItemsCount === 0 && !isPending;
        return true;
    });

    const getStatusPill = (draft) => {
        if (!draft || (!draft.items?.length && draft.status === 'DRAFT')) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/5 text-gray-400 border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> Idle / Clean
                </span>
            );
        }
        if (draft.status === 'PENDING_REVIEW') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                    <Clock className="w-3 h-3" /> Submitted for Review
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <FileText className="w-3 h-3" /> Working Draft
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <span className="p-2.5 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl text-yellow-400">
                            <GitPullRequest className="w-6 h-6" />
                        </span>
                        <span>Staging & Editor Workspaces</span>
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {isEditor
                            ? 'Stage your player updates safely without touching primary collections. Submit when ready for Admin sign-off.'
                            : 'Monitor active editor drafts in real time. Approve and merge staged changes directly to the primary database.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button
                        onClick={fetchWorkspaces}
                        disabled={isLoading}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                        title="Refresh Workspaces"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-yellow-400' : ''}`} />
                    </button>

                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-black font-bold text-sm rounded-xl shadow-lg shadow-orange-500/10 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Change Batch</span>
                    </button>
                </div>
            </div>

            {/* Notification alert */}
            <AnimatePresence>
                {actionMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
                            actionMessage.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            <span>{actionMessage.text}</span>
                        </div>
                        <button onClick={() => setActionMessage(null)} className="opacity-70 hover:opacity-100">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5">
                {[
                    { id: 'ALL', label: `All Staff (${workspaces.length})` },
                    { id: 'PENDING', label: `Pending Review (${workspaces.filter(w => w.activeDraft?.status === 'PENDING_REVIEW').length})` },
                    { id: 'ACTIVE', label: `Active Drafts (${workspaces.filter(w => (w.activeDraft?.items?.length || 0) > 0).length})` },
                    { id: 'IDLE', label: `Idle (${workspaces.filter(w => (w.activeDraft?.items?.length || 0) === 0 && w.activeDraft?.status !== 'PENDING_REVIEW').length})` }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilterTab(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            filterTab === tab.id
                                ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20'
                                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Consolidated Workspaces Grid (One working card per editor; No separate approved cards on the right) */}
            {isLoading && workspaces.length === 0 ? (
                <div className="py-20 text-center text-gray-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-500" />
                    <p className="text-sm">Loading staff workspaces...</p>
                </div>
            ) : filteredWorkspaces.length === 0 ? (
                <div className="py-16 text-center bg-white/[0.01] border border-white/5 rounded-2xl p-8">
                    <GitPullRequest className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                    <h3 className="text-base font-semibold text-gray-300">No workspaces match this filter</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                        Switch back to "All Staff" or have editors stage updates in the Players tab.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredWorkspaces.map((ws) => {
                        const draft = ws.activeDraft;
                        const itemsCount = draft?.items?.length || 0;
                        const hasConflicts = draft?.items?.some(it => it.hasConflict);
                        const isPending = draft?.status === 'PENDING_REVIEW';
                        const totalContributionsCount = ws.totalContributions?.total || 0;

                        return (
                            <div
                                key={ws.editorId}
                                className={`bg-[#121217] border rounded-2xl p-5 transition-all shadow-xl flex flex-col justify-between ${
                                    isPending
                                        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                                        : itemsCount > 0
                                        ? 'border-purple-500/30'
                                        : 'border-white/10 hover:border-white/20'
                                }`}
                            >
                                <div>
                                    {/* Card Header: Editor info, role, and the History Icon */}
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-bold text-xs uppercase">
                                                {ws.editorUsername.slice(0, 2)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-base text-white">{ws.activeDraft?.title || `Draft - ${ws.editorUsername}`}</h3>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                        ws.role === 'admin' || ws.role === 'superadmin'
                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                    }`}>
                                                        {ws.role === 'admin' ? 'Admin' : 'Editor'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                    <span>Editor: <strong className="text-gray-200">{ws.editorUsername}</strong></span>
                                                    <span>•</span>
                                                    <span className="font-mono text-yellow-400/80">{draft?.targetDb || 'ipl'}.{draft?.targetCollection || 'ipl_data'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Header Side: Status pill & Small History Icon */}
                                        <div className="flex items-center gap-2">
                                            {getStatusPill(draft)}

                                            {/* Small History Icon Button on the Working Draft Card */}
                                            <button
                                                onClick={() => setSelectedHistoryEditor(ws)}
                                                className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-yellow-500/15 border border-white/10 hover:border-yellow-500/30 text-gray-400 hover:text-yellow-400 text-xs font-semibold transition-all"
                                                title={`View contribution history for ${ws.editorUsername}`}
                                            >
                                                <History className="w-3.5 h-3.5 text-yellow-500 group-hover:rotate-[-20deg] transition-transform" />
                                                <span className="text-[11px] font-bold">
                                                    {totalContributionsCount > 0 ? `${totalContributionsCount}` : '0'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Middle Section: Staged changes info */}
                                    <div className="my-4 bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-400 font-medium">Currently Staged Modifications:</span>
                                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded">
                                                    +{draft?.counts?.created || 0} Added
                                                </span>
                                                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded">
                                                    ~{draft?.counts?.updated || 0} Modified
                                                </span>
                                                <span className="bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded">
                                                    -{draft?.counts?.deleted || 0} Deleted
                                                </span>
                                            </div>
                                        </div>

                                        {/* Player preview chips or idle notice */}
                                        {itemsCount > 0 ? (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                {draft.items.slice(0, 3).map(it => (
                                                    <span
                                                        key={it._id}
                                                        className={`text-[11px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                                                            it.hasConflict
                                                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                                                : 'bg-white/5 text-gray-300 border-white/10'
                                                        }`}
                                                    >
                                                        <span className="text-[9px] uppercase font-bold text-gray-400">{it.actionType}:</span>
                                                        <span>{it.playerName}</span>
                                                        {it.hasConflict && <AlertCircle className="w-3 h-3 text-rose-400 ml-0.5" />}
                                                    </span>
                                                ))}
                                                {itemsCount > 3 && (
                                                    <span className="text-[10px] text-gray-400 font-semibold px-1.5">
                                                        +{itemsCount - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">
                                                No active modifications staged. Changes made by {ws.editorUsername} in the Players tab will automatically stage here.
                                            </p>
                                        )}

                                        {/* Concurrency Conflict Alert */}
                                        {hasConflicts && (
                                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-xs text-rose-300 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                                <span>A player in this draft was updated in the primary DB. Inspect diffs to resolve.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Working Card Footer Actions */}
                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <button
                                        onClick={() => openRequestDetails(draft._id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors py-1.5"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span>Inspect Diffs ({itemsCount})</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {/* FOR ADMIN: Directly Approve & Merge to Primary DB */}
                                        {!isEditor && itemsCount > 0 && (
                                            <>
                                                <button
                                                    onClick={() => handleAdminReview(draft._id, 'APPROVE')}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                                                    title="Approve and merge staged draft into primary database"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Approve & Merge</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDiscardDraft(draft._id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Discard Staged Draft"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {/* FOR EDITOR: Submit for Admin Approval */}
                                        {isEditor && draft?.status === 'DRAFT' && itemsCount > 0 && (
                                            <>
                                                <button
                                                    onClick={() => handleSubmitForReview(draft._id)}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    <span>Submit for Approval</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDiscardDraft(draft._id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Discard Draft"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {/* FOR EDITOR: Awaiting Admin Sign-off badge */}
                                        {isEditor && isPending && (
                                            <span className="text-xs text-amber-400 font-semibold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                                Awaiting Admin Approval
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ======================================================== */}
            {/* MODAL 1: CONTRIBUTION HISTORY MODAL (Opened from History Icon) */}
            {/* ======================================================== */}
            <AnimatePresence>
                {selectedHistoryEditor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#121217] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/10 flex items-start justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl font-bold text-white">Contribution History</h3>
                                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                                                @{selectedHistoryEditor.editorUsername}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Audited log of player updates approved and merged into the primary database.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedHistoryEditor(null)}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Summary Metrics Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-black/30 border-b border-white/5">
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Contributed</div>
                                    <div className="text-xl font-black text-white mt-1">
                                        {selectedHistoryEditor.totalContributions?.total || 0}
                                    </div>
                                </div>
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                    <div className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">Added Players</div>
                                    <div className="text-xl font-black text-emerald-400 mt-1">
                                        +{selectedHistoryEditor.totalContributions?.created || 0}
                                    </div>
                                </div>
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                    <div className="text-[10px] uppercase font-bold text-amber-400/80 tracking-wider">Modified Stats</div>
                                    <div className="text-xl font-black text-amber-400 mt-1">
                                        ~{selectedHistoryEditor.totalContributions?.updated || 0}
                                    </div>
                                </div>
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                                    <div className="text-[10px] uppercase font-bold text-blue-400/80 tracking-wider">Merged Batches</div>
                                    <div className="text-xl font-black text-blue-400 mt-1">
                                        {selectedHistoryEditor.historyCount || 0}
                                    </div>
                                </div>
                            </div>

                            {/* History Batches List */}
                            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                                {(!selectedHistoryEditor.history || selectedHistoryEditor.history.length === 0) ? (
                                    <div className="py-12 text-center">
                                        <History className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                                        <h4 className="text-sm font-semibold text-gray-300">No merged contributions yet</h4>
                                        <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                                            Once the admin approves drafts from {selectedHistoryEditor.editorUsername}, their verified contributions will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    selectedHistoryEditor.history.map((batch) => {
                                        const isExpanded = expandedHistoryId === batch._id;
                                        return (
                                            <div
                                                key={batch._id}
                                                className="bg-white/[0.02] border border-white/10 rounded-xl p-4 transition-all"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h5 className="font-bold text-sm text-white">{batch.title}</h5>
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <CheckCircle2 className="w-3 h-3" /> Merged
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1.5">
                                                            <span>Merged on {new Date(batch.reviewedAt || batch.updatedAt).toLocaleDateString()}</span>
                                                            <span>•</span>
                                                            <span>Reviewed by <strong className="text-gray-300">{batch.reviewerUsername || 'Admin'}</strong></span>
                                                            <span>•</span>
                                                            <span className="font-mono text-yellow-400/80">{batch.targetDb || 'ipl'}.{batch.targetCollection || 'ipl_data'}</span>
                                                        </div>

                                                        {batch.adminNotes && (
                                                            <p className="text-xs text-gray-300 mt-2 bg-white/5 p-2 rounded-lg border border-white/5">
                                                                <strong className="text-gray-400">Admin Note:</strong> {batch.adminNotes}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => openRequestDetails(batch._id)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-yellow-400 rounded-lg transition-colors"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>Inspect Diffs ({batch.items?.length || 0})</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Counts summary */}
                                                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/5 text-[11px] font-mono">
                                                    <span className="text-emerald-400 font-semibold">+{batch.counts?.created || 0} Added</span>
                                                    <span>•</span>
                                                    <span className="text-amber-400 font-semibold">~{batch.counts?.updated || 0} Modified</span>
                                                    <span>•</span>
                                                    <span className="text-rose-400 font-semibold">-{batch.counts?.deleted || 0} Deleted</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
                                <button
                                    onClick={() => setSelectedHistoryEditor(null)}
                                    className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all"
                                >
                                    Close History
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ======================================================== */}
            {/* MODAL 2: DIFF INSPECTOR & MERGE MODAL */}
            {/* ======================================================== */}
            <AnimatePresence>
                {selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#121217] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/10 flex items-start justify-between bg-white/[0.02]">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold text-white">{selectedRequest.title}</h3>
                                        {getStatusPill(selectedRequest)}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-2">
                                        <span>Editor: <strong className="text-gray-200">{selectedRequest.editorUsername}</strong></span>
                                        <span>•</span>
                                        <span>Target: <strong className="text-yellow-400 font-mono">{selectedRequest.targetDb || 'ipl'}.{selectedRequest.targetCollection || 'ipl_data'}</strong></span>
                                        <span>•</span>
                                        <span>{selectedRequest.items?.length || 0} staged changes</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Content / Diff Viewer */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {selectedRequest.description && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-300">
                                        <strong className="text-gray-400 block mb-1">Editor Notes:</strong>
                                        {selectedRequest.description}
                                    </div>
                                )}

                                {selectedRequest.adminNotes && selectedRequest.status === 'APPROVED' && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300">
                                        <strong className="text-emerald-400 block mb-1">Approved by {selectedRequest.reviewerUsername}:</strong>
                                        {selectedRequest.adminNotes}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 flex items-center justify-between">
                                        <span>Changes in this Proposal</span>
                                        <span className="text-[10px] text-gray-500">Showing field-by-field verification</span>
                                    </h4>

                                    {(!selectedRequest.items || selectedRequest.items.length === 0) ? (
                                        <p className="text-center text-sm text-gray-500 py-8">No changes staged in this batch yet.</p>
                                    ) : (
                                        selectedRequest.items.map((item) => (
                                            <div
                                                key={item._id}
                                                className={`border rounded-xl p-4 transition-all ${
                                                    item.hasConflict
                                                        ? 'bg-rose-950/20 border-rose-500/40'
                                                        : item.actionType === 'CREATE'
                                                        ? 'bg-emerald-950/10 border-emerald-500/30'
                                                        : item.actionType === 'DELETE'
                                                        ? 'bg-rose-950/10 border-rose-500/30'
                                                        : 'bg-white/[0.02] border-white/10'
                                                }`}
                                            >
                                                {/* Item Header */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        {!isEditor && selectedRequest.status !== 'APPROVED' && (
                                                            <input
                                                                type="checkbox"
                                                                checked={!!itemApprovals[item._id]}
                                                                onChange={(e) => setItemApprovals(prev => ({
                                                                    ...prev,
                                                                    [item._id]: e.target.checked
                                                                }))}
                                                                className="w-4 h-4 rounded text-yellow-500 focus:ring-0 cursor-pointer"
                                                            />
                                                        )}

                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                            item.actionType === 'CREATE'
                                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                                : item.actionType === 'DELETE'
                                                                ? 'bg-rose-500/20 text-rose-400'
                                                                : 'bg-amber-500/20 text-amber-400'
                                                        }`}>
                                                            {item.actionType}
                                                        </span>

                                                        <h5 className="font-bold text-sm text-white">{item.playerName}</h5>
                                                        {item.playerId && (
                                                            <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                                                                ID: {item.playerId}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {selectedRequest.status === 'DRAFT' && (
                                                            <button
                                                                onClick={() => handleRemoveItem(selectedRequest._id, item._id)}
                                                                className="text-gray-500 hover:text-rose-400 p-1 transition-colors"
                                                                title="Remove item from draft"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Conflict Alert Banner */}
                                                {item.hasConflict && (
                                                    <div className="mb-3 bg-rose-500/20 border border-rose-500/40 rounded-lg p-2.5 text-xs text-rose-300 flex items-start gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <strong className="font-bold">Concurrency Conflict Detected:</strong>{' '}
                                                            {item.conflictDetails?.message || 'Primary database was altered since this draft was started.'}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Field-by-field Diff Display */}
                                                {item.actionType === 'UPDATE' && item.diff && (
                                                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2">
                                                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                                                            Field Modifications:
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                            {Object.entries(item.diff).map(([key, delta]) => (
                                                                <div key={key} className="bg-white/[0.02] border border-white/5 p-2 rounded-lg">
                                                                    <div className="text-[10px] text-gray-400 font-mono mb-1">{key}</div>
                                                                    <div className="flex items-center gap-2 font-mono">
                                                                        <span className="line-through text-rose-400/80 bg-rose-500/10 px-1.5 py-0.5 rounded text-[11px]">
                                                                            {delta.old !== null && delta.old !== undefined ? String(delta.old) : 'null'}
                                                                        </span>
                                                                        <ArrowRight className="w-3 h-3 text-gray-500" />
                                                                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                                                                            {delta.new !== null && delta.new !== undefined ? String(delta.new) : 'null'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {item.actionType === 'CREATE' && item.proposedData && (
                                                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-xs text-gray-300 space-y-1 font-mono">
                                                        <div>Role: <span className="text-emerald-400">{item.proposedData.role || 'N/A'}</span></div>
                                                        <div>Base Price: <span className="text-yellow-400">{item.proposedData.basePrice || 0}L</span></div>
                                                        <div>Nationality: <span className="text-blue-400">{item.proposedData.nationality || 'N/A'}</span></div>
                                                    </div>
                                                )}

                                                {item.actionType === 'DELETE' && (
                                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300">
                                                        Player is staged to be permanently deleted from <strong className="font-mono">{item.targetCollection || 'ipl_data'}</strong>.
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Admin Sign-Off Feedback box */}
                                {!isEditor && selectedRequest.status !== 'APPROVED' && (
                                    <div className="pt-4 border-t border-white/10 space-y-2">
                                        <label className="block text-xs font-semibold text-gray-400">
                                            Admin Feedback / Merge Notes (Optional)
                                        </label>
                                        <textarea
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            placeholder="Add comments or notes for this merge..."
                                            rows={2}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                                >
                                    Close Inspector
                                </button>

                                <div className="flex items-center gap-3">
                                    {/* FOR EDITOR: Submit button */}
                                    {isEditor && selectedRequest.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleSubmitForReview(selectedRequest._id)}
                                            disabled={isProcessing || !selectedRequest.items || selectedRequest.items.length === 0}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
                                        >
                                            <Send className="w-4 h-4" />
                                            <span>Submit for Admin Approval</span>
                                        </button>
                                    )}

                                    {/* FOR ADMIN: Approve & Merge directly into Primary DB */}
                                    {!isEditor && selectedRequest.status !== 'APPROVED' && (
                                        <>
                                            <button
                                                onClick={() => handleAdminReview(selectedRequest._id, 'REJECT')}
                                                disabled={isProcessing}
                                                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 font-bold text-xs rounded-xl transition-all"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                <span>Reject Proposal</span>
                                            </button>

                                            <button
                                                onClick={() => handleAdminReview(selectedRequest._id, 'APPROVE')}
                                                disabled={isProcessing || !selectedRequest.items || selectedRequest.items.length === 0}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>Approve & Merge All to Primary DB</span>
                                            </button>
                                        </>
                                    )}

                                    {selectedRequest.status === 'APPROVED' && (
                                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                            <CheckCircle2 className="w-4 h-4" /> Merged to Primary DB
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ======================================================== */}
            {/* MODAL 3: CREATE NEW BATCH */}
            {/* ======================================================== */}
            <AnimatePresence>
                {showNewModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#16161b] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <GitPullRequest className="w-5 h-5 text-yellow-500" />
                                    <span>Create Staging Batch</span>
                                </h3>
                                <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateBatch} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Batch Title *</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="e.g. 2026 Season Batsmen Stats Update"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Description / Notes for Admin</label>
                                    <textarea
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        placeholder="Describe what changes are included (e.g. revised strike rates, overseas player additions)..."
                                        rows={3}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewModal(false)}
                                        className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isProcessing || !newTitle.trim()}
                                        className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                                    >
                                        Create Batch
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChangeRequestManager;
