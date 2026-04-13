"use client";

/**
 * Admin report page — download the full inventory verification report as Excel.
 */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUser } from "../../../types";

export default function ReportPage() {
  const { data: session, status } = useSession();
  const user = (session?.user as SessionUser | undefined) ?? null;
  const router = useRouter();

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && user?.role !== "ADMIN") router.replace("/");
  }, [status, user, router]);

  async function handleDownload() {
    setDownloading(true);
    setError("");

    try {
      const res = await fetch("/api/report");

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate report");
      }

      // Trigger file download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      a.href = url;
      a.download = `inventory-report-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastDownloaded(now.toLocaleString("it-IT"));
    } catch (e: any) {
      setError(e.message ?? "An error occurred");
    } finally {
      setDownloading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-bold text-gray-900 text-lg">Download Report</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Report info */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-2">Inventory Verification Report</h2>
          <p className="text-sm text-gray-500 mb-4">
            Downloads a complete Excel report with verification data from all three stores,
            including per-product final status, quantity discrepancies, and notes.
          </p>

          {/* Column preview */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Report columns:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "SKU", "Product Name", "Brand", "Category",
                "Theoretical Qty", "Global Presence",
                "Store1 Status", "Store1 Qty",
                "Store2 Status", "Store2 Qty",
                "Store3 Status", "Store3 Qty",
                "Total Detected Qty", "Final Status",
                "Verification Count", "Last Verification Date", "Notes"
              ].map((col) => (
                <span key={col} className="badge bg-gray-200 text-gray-700 text-xs">{col}</span>
              ))}
            </div>
          </div>

          {/* Final status legend */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Final status values:</p>
            <div className="space-y-1">
              {[
                { status: "DISPONIBILE", desc: "All stores found it, qty matches", color: "bg-green-100 text-green-700" },
                { status: "NON TROVATO", desc: "No store found it", color: "bg-red-100 text-red-700" },
                { status: "DISCREPANZA", desc: "Found but qty differs", color: "bg-orange-100 text-orange-700" },
                { status: "DA RICONTROLLARE", desc: "Mixed results or 'not sure'", color: "bg-yellow-100 text-yellow-700" },
                { status: "NON VERIFICATO", desc: "Not yet surveyed", color: "bg-gray-100 text-gray-600" },
              ].map(({ status, desc, color }) => (
                <div key={status} className="flex items-center gap-2">
                  <span className={`badge ${color} text-xs whitespace-nowrap`}>{status}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Download button */}
        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {lastDownloaded && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Last downloaded at {lastDownloaded}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-3"
          >
            {downloading ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating report…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Excel Report
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
