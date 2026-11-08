'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  BookOpen,
  UploadCloud,
  Search,
  Sparkles,
  FileText,
  Send,
  CheckCircle,
  Database,
  Quote,
} from 'lucide-react';

export default function KnowledgePage() {
  const { activeOrg } = useAuth();

  // Document Ingestion state
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  // RAG Search & Query state
  const [query, setQuery] = useState('');
  const [querying, setQuerying] = useState(false);
  const [ragResult, setRagResult] = useState<any>(null);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docContent || !activeOrg) return;

    setIngesting(true);
    setIngestSuccess(null);
    try {
      // Call FastAPI microservice directly for document chunking & pgvector ingestion
      const res = await fetch('http://localhost:8000/api/v1/documents/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: activeOrg.id,
          title: docTitle,
          content: docContent,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIngestSuccess(
          `Document "${docTitle}" successfully processed and split into ${data.total_chunks} vector chunks!`,
        );
        setDocTitle('');
        setDocContent('');
      } else {
        alert(data.detail || 'Ingestion failed');
      }
    } catch (err: any) {
      alert(`Ingestion error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  const handleRagQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || !activeOrg) return;

    setQuerying(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: activeOrg.id,
          question: query,
          top_k: 3,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRagResult(data);
      } else {
        alert(data.detail || 'Query failed');
      }
    } catch (err: any) {
      alert(`Query error: ${err.message}`);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-brand-600" />
          <span>Knowledge Base & Semantic RAG Engine</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vectorized enterprise knowledge base powered by PostgreSQL 16 `pgvector`, HNSW cosine indexing, and citation-backed synthesis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Document Ingestion */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <UploadCloud className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Add Knowledge Document</h3>
          </div>

          {ingestSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{ingestSuccess}</span>
            </div>
          )}

          <form onSubmit={handleIngest} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Document Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Billing Policies & Enterprise SLA 2026"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Document Content / Text
              </label>
              <textarea
                required
                rows={8}
                placeholder="Paste internal documentation, operational runbooks, policy manuals, or knowledge guides..."
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                <span>Chunks indexed in 1536-dim vector space</span>
              </span>
              <button
                type="submit"
                disabled={ingesting || !docTitle || !docContent}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>{ingesting ? 'Chunking & Embedding...' : 'Ingest Document'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Interactive RAG Query & Citations */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Semantic RAG Assistant</h3>
          </div>

          <form onSubmit={handleRagQuery} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Ask anything about your internal documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={querying || !query}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1"
            >
              <span>{querying ? 'Searching...' : 'Ask RAG'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* RAG Answer Display */}
          {ragResult ? (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Synthesized Knowledge Answer</span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {ragResult.answer}
                </p>
              </div>

              {/* Citations List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Grounding Citations ({ragResult.citations?.length || 0})
                </div>

                {ragResult.citations?.map((cit: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs hover:border-brand-300 transition"
                  >
                    <div className="flex items-center justify-between text-slate-800 font-semibold">
                      <span className="flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        {cit.documentTitle}
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-bold">
                        {(cit.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] italic bg-slate-50 p-2 rounded border border-slate-100">
                      &quot;{cit.excerpt}&quot;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400">
              Enter a question to query your vectorized documents with cosine similarity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
