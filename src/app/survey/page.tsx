"use client";

/**
 * Survey page — mobile-optimized.
 * Clerks see one product at a time and tap to record their verification.
 *
 * Progress tracking: stateless — each "next product" is computed server-side
 * by finding the first unverified, unlocked product (by id ASC).
 * No sessionStorage, no watermarking, no offset pagination.
 */

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { Product, VerificationStatus, SessionUser } from "../../types";

export default function SurveyPage() {
  const { data: session, status } = useSession();
  const user = (session?.user as SessionUser | undefined) ?? null;
  const router = useRouter();

  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  // history: initialized from server (all verified products for this clerk/store), then
  // updated in-memory as the session progresses. Persists across re-logins via server reload.
  const [history, setHistory] = useState<Product[]>([]);
  // future keeps products popped from history, for Forward navigation
  const [future, setFuture] = useState<Product[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<VerificationStatus | null>(null);
  const [detectedQty, setDetectedQty] = useState<string>("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [storeStats, setStoreStats] = useState<any>(null);
  const [currentVerificationId, setCurrentVerificationId] = useState<number | null>(null);
  // isEditMode: true for new products, false when showing an already-verified product (read-only)
  const [isEditMode, setIsEditMode] = useState(false);
  const initialized = useRef(false);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && user?.role === "ADMIN") router.replace("/");
  }, [status, user, router]);

  // Initialize on first authenticated render
  useEffect(() => {
    if (status !== "authenticated" || user?.role !== "CLERK" || initialized.current) return;
    initialized.current = true;

    // Load store stats (background, non-blocking)
    fetch("/api/stats/daily")
      .then((r) => r.json())
      .then((data) => setStoreStats(data))
      .catch(() => {});

    // Load brands/categories for filter dropdowns
    fetch("/api/products?page=1&pageSize=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.brands?.length) setAvailableBrands(data.brands);
        if (data.categories?.length) setAvailableCategories(data.categories);
      })
      .catch(() => {});

    // Restore back-navigation history from server (persists across sessions/re-logins)
    fetch("/api/verifications/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.products?.length) setHistory(data.products);
      })
      .catch(() => {});

    loadNextProduct();
  }, [status, user]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setSelectedStatus(null);
    setDetectedQty("");
    setNote("");
    setError("");
    setCurrentVerificationId(null);
    setIsEditMode(false);
  }

  /**
   * Asks the server for the next product to verify, loads it, and marks it IN_PROGRESS.
   * Optionally pushes the previous product to history for Back navigation.
   */
  async function loadNextProduct(previousProduct?: Product) {
    setLoading(true);
    resetForm();
    setFuture([]);
    try {
      // Get next product id from the server
      const prog = await fetch("/api/verifications/progress").then((r) => r.json());
      setVerifiedCount(prog.verifiedCount ?? 0);
      setTotalProducts(prog.total ?? 0);

      if (prog.done || !prog.productId) {
        setDone(true);
        setCurrentProduct(null);
        setLoading(false);
        return;
      }

      // Load product details
      const prodData = await fetch(`/api/products?id=${prog.productId}`).then((r) => r.json());
      const product: Product = prodData.products?.[0];
      if (!product) throw new Error("Product not found");

      // Push previous product to history for Back button (avoid duplicates)
      if (previousProduct) {
        setHistory((h) =>
          h.some((p) => p.id === previousProduct.id) ? h : [...h, previousProduct]
        );
      }
      setCurrentProduct(product);

      // Mark as IN_PROGRESS (fire-and-forget)
      fetch("/api/verifications/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      }).catch(() => {});

      // Pre-populate form if this product already has a verification
      const verif = await fetch(`/api/verifications?productId=${product.id}`).then((r) => r.json());
      if (verif?.id) {
        setCurrentVerificationId(verif.id);
        setSelectedStatus(verif.status as VerificationStatus);
        setDetectedQty(verif.detectedQty != null ? String(verif.detectedQty) : "");
        setNote(verif.note ?? "");
        setIsEditMode(false); // show read-only, user must press Modifica to edit
      } else {
        setIsEditMode(true); // new product — go straight to edit mode
      }
    } catch {
      setError("Could not load products. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Go back to the previous product. History is server-loaded on init so it
   * survives server restarts and re-logins.
   */
  async function handleBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    // Push current product into future so Forward can return to it
    if (currentProduct) setFuture((f) => [...f, currentProduct]);
    setLoading(true);
    resetForm();
    setDone(false);
    setCurrentProduct(prev);

    // Mark as IN_PROGRESS
    fetch("/api/verifications/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: prev.id }),
    }).catch(() => {});

    // Load existing verification
    const verif = await fetch(`/api/verifications?productId=${prev.id}`).then((r) => r.json()).catch(() => null);
    if (verif?.id) {
      setCurrentVerificationId(verif.id);
      setSelectedStatus(verif.status as VerificationStatus);
      setDetectedQty(verif.detectedQty != null ? String(verif.detectedQty) : "");
      setNote(verif.note ?? "");
      setIsEditMode(false);
    } else {
      setIsEditMode(true);
    }
    setLoading(false);
  }

  async function handleForward() {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    // Push current product into history so Back can return to it
    if (currentProduct) setHistory((h) => [...h, currentProduct]);
    setLoading(true);
    resetForm();
    setDone(false);
    setCurrentProduct(next);

    fetch("/api/verifications/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: next.id }),
    }).catch(() => {});

    const verif = await fetch(`/api/verifications?productId=${next.id}`).then((r) => r.json()).catch(() => null);
    if (verif?.id) {
      setCurrentVerificationId(verif.id);
      setSelectedStatus(verif.status as VerificationStatus);
      setDetectedQty(verif.detectedQty != null ? String(verif.detectedQty) : "");
      setNote(verif.note ?? "");
      setIsEditMode(false);
    } else {
      setIsEditMode(true);
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!selectedStatus || !currentProduct) return;
    setSubmitting(true);
    setError("");

    // Capture before async work: true = re-editing an already-saved verification
    const wasEdit = !!currentVerificationId;

    try {
      const method = wasEdit ? "PATCH" : "POST";
      const body = wasEdit
        ? { id: currentVerificationId, status: selectedStatus, detectedQty: detectedQty ? parseInt(detectedQty, 10) : null, note: note.trim() || null }
        : { productId: currentProduct.id, status: selectedStatus, detectedQty: detectedQty ? parseInt(detectedQty, 10) : null, note: note.trim() || null };

      const res = await fetch("/api/verifications", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody.error ?? "Submission failed");
      }

      // Refresh daily stats in background
      fetch("/api/stats/daily").then((r) => r.json()).then(setStoreStats).catch(() => {});

      if (wasEdit) {
        // Re-edited an existing verification: stay on this product in read-only mode.
        // history and future are left intact so ← and → keep working.
        setIsEditMode(false);
      } else {
        // New verification: advance to the next unverified product.
        await loadNextProduct(currentProduct);
      }
    } catch (e: any) {
      setError(e.message ?? "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!currentProduct) return;
    // No SKIPPED record needed — the new progress algorithm finds next by id ASC,
    // ignoring products not yet verified.
    await loadNextProduct(currentProduct);
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">Loading products…</p>
      </div>
    );
  }

  // ── Done state ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Survey Complete!</h1>
        <p className="text-gray-500 mb-8">
          You have verified all {totalProducts} products for {user?.storeName ?? "your store"}.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={handleBack} className="btn-secondary px-8 py-3">
            ← Rivedi verifiche
          </button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-primary px-8 py-3">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ── No products ────────────────────────────────────────────────────────────
  if (!currentProduct) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <p className="text-gray-500 text-lg mb-4">No products available yet.</p>
        <p className="text-gray-400 text-sm">Ask your admin to import the product catalogue.</p>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary mt-6">
          Sign out
        </button>
      </div>
    );
  }

  // ── Progress ───────────────────────────────────────────────────────────────
  const progressPct = totalProducts > 0 ? Math.round((verifiedCount / totalProducts) * 100) : 0;

  // ── Main survey UI ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{user?.storeName ?? "Store"}</p>
            <p className="font-semibold text-gray-900 text-sm">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={history.length === 0}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Prodotto precedente"
            >
              ←
            </button>
            <div className="text-center">
              <p className="text-xs text-gray-500">Verificati</p>
              <p className="font-bold text-indigo-600">
                {verifiedCount} / {totalProducts}
              </p>
            </div>
            <button
              onClick={handleForward}
              disabled={future.length === 0}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Prodotto successivo"
            >
              →
            </button>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Exit
          </button>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 h-1.5">
          <div
            className="bg-indigo-600 h-1.5 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* Brand filter (cosmetic — shows available brands for reference) */}
      {availableBrands.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <label className="text-xs font-medium text-gray-600 mb-2 block">Filter by Brand</label>
          <select
            value={selectedBrand ?? ""}
            onChange={(e) => setSelectedBrand(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
          >
            <option value="">Tutti i Brand</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
      )}

      {/* Category filter (cosmetic) */}
      {availableCategories.length > 1 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <label className="text-xs font-medium text-gray-600 mb-2 block">Filter by Type</label>
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
          >
            <option value="">All Types</option>
            {[...availableCategories].sort().map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      )}

      {/* Daily stats */}
      {storeStats?.byStore && storeStats.byStore.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <p className="text-xs font-medium text-gray-600 mb-2">📊 Today's Verifications</p>
          <div className="grid grid-cols-3 gap-2">
            {storeStats.byStore.map((store: any) => (
              <div
                key={store.storeId}
                className={`text-center p-2 rounded-lg ${
                  store.storeName === user?.storeName
                    ? "bg-indigo-100 border border-indigo-300"
                    : "bg-gray-100"
                }`}
              >
                <p className="text-xs font-semibold text-gray-700">{store.storeName}</p>
                <p className="text-lg font-bold text-indigo-600">{store.dayVerifications}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product card */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Banner: prodotto già verificato in read-only */}
        {currentVerificationId && !isEditMode && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            <span>👁️</span>
            <span>Verifica già salvata — premi <strong>Modifica</strong> per cambiare</span>
          </div>
        )}
        {/* Banner: in corso di modifica */}
        {currentVerificationId && isEditMode && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <span>✏️</span>
            <span>Stai modificando una verifica già salvata</span>
          </div>
        )}
        {/* Product image */}
        <div className="card p-0 overflow-hidden">
          {currentProduct.imageUrl ? (
            <div className="relative w-full h-56 bg-gray-100">
              <img
                src={currentProduct.imageUrl}
                alt={currentProduct.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.png";
                }}
              />
            </div>
          ) : (
            <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <div className="p-4">
            <p className="text-xs text-gray-400 font-mono mb-0.5">SKU: {currentProduct.sku}</p>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{currentProduct.name}</h2>
            {currentProduct.brand && (
              <p className="text-sm text-gray-500 mt-0.5">{currentProduct.brand}</p>
            )}
            {currentProduct.category && (
              <span className="badge bg-gray-100 text-gray-600 mt-2">{currentProduct.category}</span>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-500">Expected qty:</span>
              <span className="font-semibold text-gray-900">{currentProduct.theoreticalQty}</span>
            </div>
          </div>
        </div>

        {/* Status buttons */}
        <div className="card">
          <p className="text-sm font-medium text-gray-700 mb-3">Product status</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => isEditMode && setSelectedStatus("PRESENT")}
              disabled={!isEditMode}
              className={`btn-survey border-2 ${
                selectedStatus === "PRESENT"
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white text-green-700 border-green-300 hover:bg-green-50"
              } disabled:opacity-60 disabled:cursor-default`}
            >
              <span className="text-2xl">✅</span>
              Present
            </button>
            <button
              onClick={() => isEditMode && setSelectedStatus("NOT_PRESENT")}
              disabled={!isEditMode}
              className={`btn-survey border-2 ${
                selectedStatus === "NOT_PRESENT"
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-red-700 border-red-300 hover:bg-red-50"
              } disabled:opacity-60 disabled:cursor-default`}
            >
              <span className="text-2xl">❌</span>
              Not Found
            </button>
            {/* Skip: only available for new products */}
            {!currentVerificationId && (
              <button
                onClick={handleSkip}
                className="btn-survey border-2 col-span-2 bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              >
                <span className="text-2xl">⏭</span>
                Skip
              </button>
            )}
          </div>
        </div>

        {/* Modifica button — shown only when product is already verified and in read-only mode */}
        {currentVerificationId && !isEditMode && (
          <button
            onClick={() => setIsEditMode(true)}
            className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
          >
            <span>✏️</span>
            Modifica
          </button>
        )}

        {/* Quantity input — shown when PRESENT */}
        {selectedStatus === "PRESENT" && (
          <div className="card">
            <label className="label">Detected quantity</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={detectedQty}
              onChange={(e) => setDetectedQty(e.target.value)}
              disabled={!isEditMode}
              className={`input text-2xl font-bold text-center py-4 ${!isEditMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
              placeholder="0"
            />
          </div>
        )}

        {/* Note input */}
        {selectedStatus && selectedStatus !== "SKIPPED" && (
          <div className="card">
            <label className="label">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!isEditMode}
              className={`input resize-none h-20 ${!isEditMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
              placeholder="Add a note…"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Submit — only when in edit mode */}
        {isEditMode && selectedStatus && selectedStatus !== "SKIPPED" && (
          <button
            onClick={handleSubmit}
            disabled={submitting || (selectedStatus === "PRESENT" && detectedQty === "")}
            className="btn-primary w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              "Confirm & Next →"
            )}
          </button>
        )}

        {/* Bottom padding for mobile */}
        <div className="h-8" />
      </div>
    </div>
  );
}
