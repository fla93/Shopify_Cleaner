"use client";

/**
 * Dashboard page (/)
 *  - ADMIN: shows stats, import button, report download button
 *  - CLERK: redirected to /survey
 *  - Not logged in: redirected to /login
 */

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { StatsResponse, SessionUser } from "../types";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const user = (session?.user as SessionUser | undefined) ?? null;
  const router = useRouter();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState("");
  const [dailyStats, setDailyStats] = useState<any>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Redirect clerks to survey
  useEffect(() => {
    if (status === "authenticated" && user?.role === "CLERK") {
      router.replace("/survey");
    }
  }, [status, user, router]);

  // Load stats for admin (with auto-refresh every 10s)
  const loadStats = useCallback(async () => {
    try {
      const [statsData, dailyData] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/stats/daily").then((r) => r.json()),
      ]);
      setStats(statsData);
      setDailyStats(dailyData);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || user?.role !== "ADMIN") return;
    setLoadingStats(true);
    loadStats().finally(() => setLoadingStats(false));
    const id = setInterval(loadStats, 10_000);
    return () => clearInterval(id);
  }, [status, user, loadStats]);

  // Handle reset
  async function handleReset() {
    setResetting(true);
    setResetError("");
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      if (!res.ok) {
        throw new Error("Reset failed");
      }
      await loadStats();
      setShowResetConfirm(false);
    } catch (e: any) {
      setResetError(e.message ?? "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  if (status === "loading" || (user?.role === "CLERK")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // ── Admin dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">Shopify Cleaner</span>
            <span className="badge bg-indigo-100 text-indigo-700 ml-2">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="btn-secondary text-sm py-1.5"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          Dashboard
        </h1>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => router.push("/admin/import")}
            className="card flex items-center gap-4 text-left hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Import Products</p>
              <p className="text-sm text-gray-500">Upload Excel file to load product catalogue</p>
            </div>
          </button>

          <button
            onClick={() => router.push("/admin/report")}
            className="card flex items-center gap-4 text-left hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Download Report</p>
              <p className="text-sm text-gray-500">Export full inventory verification report</p>
            </div>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="card flex items-center gap-4 text-left hover:shadow-md transition-shadow cursor-pointer border-2 border-red-200 hover:border-red-300"
          >
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Reset Data</p>
              <p className="text-sm text-gray-500">Delete all products & verifications</p>
            </div>
          </button>
        </div>

        {/* Stats */}
        {loadingStats ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <>
            {/* Status breakdown */}
            {Object.keys(stats.byStatus ?? {}).length > 0 && (
              <div className="card mb-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Status Breakdown</h2>
                <div className="space-y-2">
                  {Object.entries(stats.byStatus ?? {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status} />
                        <span className="text-sm text-gray-700">{status}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-store stats */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Verifications by Store</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(stats.byStore ?? []).map((s) => (
                  <div key={s.storeId} className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="font-medium text-gray-700">{s.storeName}</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{s.verificationCount}</p>
                    <p className="text-xs text-gray-500">verifications</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's stats */}
            {dailyStats?.byStore && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 Today's Verifications</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {dailyStats.byStore.map((s: any) => (
                    <div key={s.storeId} className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 text-center border border-indigo-200">
                      <p className="font-medium text-gray-700">{s.storeName}</p>
                      <p className="text-3xl font-bold text-indigo-600 mt-2">{s.dayVerifications}</p>
                      <p className="text-xs text-gray-500">today</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-lg">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Reset All Data?</h2>
              <p className="text-sm text-gray-600 mb-6">
                This will permanently delete:
              </p>
              <ul className="text-sm text-gray-600 mb-6 space-y-1 ml-4">
                <li>• All imported products</li>
                <li>• All verifications & survey data</li>
              </ul>
              <p className="text-sm font-semibold text-gray-900 mb-6">⚠️ This action cannot be undone.</p>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                  {resetError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                  className="flex-1 btn-secondary py-2.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 btn-primary py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                >
                  {resetting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resetting…
                    </span>
                  ) : (
                    "Reset All Data"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper sub-components ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`card flex flex-col items-center text-center ${color}`}>
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs mt-1 opacity-80">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    DISPONIBILE: "bg-green-100 text-green-700",
    "NON TROVATO": "bg-red-100 text-red-700",
    DISCREPANZA: "bg-orange-100 text-orange-700",
    "DA RICONTROLLARE": "bg-yellow-100 text-yellow-700",
    "NON VERIFICATO": "bg-gray-100 text-gray-600",
  };
  const cls = colorMap[status] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${cls}`}>{status}</span>;
}
