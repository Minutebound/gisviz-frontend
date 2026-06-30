// app/categories/pending/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { gisvizApi } from "@/services/api";
import { Check, X, Clock, AlertCircle, CheckSquare } from "lucide-react";

export default function PendingCategoriesPage() {
  const [pendingCategories, setPendingCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingCategories();
  }, []);

  const fetchPendingCategories = async () => {
    setLoading(true);
    try {
      const data = await gisvizApi.getPendingCategories();
      setPendingCategories(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load pending categories. Check permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (pendingId: string) => {
    try {
      await gisvizApi.approvePendingCategory(pendingId);
      // Remove from list
      setPendingCategories((prev) => prev.filter((cat) => cat.pending_id !== pendingId));
    } catch (err) {
      console.error("Failed to approve category", err);
      alert("Error approving category");
    }
  };

  const handleReject = async (pendingId: string) => {
    try {
      await gisvizApi.rejectPendingCategory(pendingId);
      // Remove from list
      setPendingCategories((prev) => prev.filter((cat) => cat.pending_id !== pendingId));
    } catch (err) {
      console.error("Failed to reject category", err);
      alert("Error rejecting category");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-theme-primary/10 p-3 rounded-xl text-theme-primary">
          <Clock size={28} />
        </div>
        <div>
          <h1 className="text-[24px] font-black text-theme-secondary">Pending Categories</h1>
          <p className="text-theme-secondary/60 font-medium">Review and approve categories suggested by users.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 mb-6">
          <AlertCircle size={20} />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary"></div>
        </div>
      ) : pendingCategories.length === 0 ? (
        <div className="bg-theme-secondary/5 rounded-2xl p-12 text-center border border-theme-secondary/10">
          <CheckSquare className="mx-auto text-theme-secondary/30 mb-4" size={48} />
          <h3 className="text-[16px] font-bold text-theme-secondary mb-1">All Caught Up!</h3>
          <p className="text-theme-secondary/60">There are no pending categories to review.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-theme-secondary/10 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-theme-secondary/5 text-theme-secondary/60 text-[12px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Suggested Label</th>
                <th className="px-6 py-4">Normalized Slug</th>
                <th className="px-6 py-4">Suggested Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-secondary/10">
              {pendingCategories.map((cat) => (
                <tr key={cat.pending_id} className="hover:bg-theme-secondary/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-theme-secondary">{cat.label}</td>
                  <td className="px-6 py-4 text-theme-secondary/70 font-mono text-sm">
                    {cat.normalized_slug}
                  </td>
                  <td className="px-6 py-4 text-theme-secondary/60 text-sm">
                    {new Date(cat.created_timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => handleApprove(cat.pending_id)}
                      className="bg-green-100 text-green-700 hover:bg-green-200 p-2 rounded-lg font-bold flex items-center gap-1 transition-colors"
                      title="Approve"
                    >
                      <Check size={18} />
                      <span className="text-sm">Approve</span>
                    </button>
                    <button
                      onClick={() => handleReject(cat.pending_id)}
                      className="bg-red-100 text-red-700 hover:bg-red-200 p-2 rounded-lg font-bold flex items-center gap-1 transition-colors"
                      title="Reject"
                    >
                      <X size={18} />
                      <span className="text-sm">Reject</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}