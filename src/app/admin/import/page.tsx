"use client";

/**
 * Admin import page — upload an Excel file to populate the product catalogue.
 */

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { SessionUser } from "../../../types";

export default function ImportPage() {
  const { data: session, status } = useSession();
  const user = (session?.user as SessionUser | undefined) ?? null;
  const router = useRouter();

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState("");

  // Auth guard — admin only
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && user?.role !== "ADMIN") router.replace("/");
  }, [status, user, router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError("");
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setResult(data);
      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);
    } catch (e: any) {
      setError(e.message ?? "An error occurred");
    } finally {
      setUploading(false);
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
          <h1 className="font-bold text-gray-900 text-lg">Import Products</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Instructions card */}
        <div className="card bg-blue-50 border border-blue-200">
          <h2 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expected Excel Format
          </h2>
          <p className="text-sm text-blue-800 mb-3">
            Upload a <strong>.xlsx</strong> or <strong>.xls</strong> file with the following columns
            in the first sheet (header row required):
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs text-blue-900 border-collapse w-full">
              <thead>
                <tr className="border-b border-blue-200">
                  {["SKU", "Product Name", "Brand", "Category", "Image URL", "Theoretical Qty"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {["ABC-001", "Widget Pro", "Acme", "Tools", "https://…", "10"].map((v, i) => (
                    <td key={i} className="px-2 py-1 text-blue-700 whitespace-nowrap">{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-blue-700 mt-2">
            If a product with the same SKU already exists, it will be updated.
          </p>
        </div>

        {/* Upload card */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Upload File</h2>

          {/* Dropzone */}
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              file
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50"
            }`}
          >
            {file ? (
              <div className="text-center">
                <svg className="w-8 h-8 text-indigo-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-indigo-700">{file.name}</p>
                <p className="text-xs text-indigo-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="text-center">
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-indigo-600">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-gray-400 mt-1">.xlsx or .xls files only</p>
              </div>
            )}
            <input
              id="file-upload"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary flex-1 py-3"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing…
                </span>
              ) : (
                "Import Products"
              )}
            </button>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="btn-secondary px-4"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Result card */}
        {result && (
          <div className="card border border-green-200 bg-green-50">
            <h2 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Import Successful
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-green-600">New</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600">Updated</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
                <p className="text-xs text-gray-500">Skipped</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
                <p className="text-xs font-medium text-yellow-800 mb-1">Warnings:</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-yellow-700">{e}</p>
                ))}
                {result.errors.length > 5 && (
                  <p className="text-xs text-yellow-600">… and {result.errors.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
