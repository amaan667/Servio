"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'committing' | 'done' | 'error';

export default function UploadMenuCard({ venueId }: { venueId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any>(null);

  const onUpload = async () => {
    if (!file) return;
    setState('uploading'); setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('venue_id', venueId);
    const up = await fetch('/api/menu/upload', { method: 'POST', body: fd });
    const uj = await up.json();
    if (!up.ok || !uj?.ok) { setError(uj?.error || 'Upload failed'); setState('error'); return; }
    setUploadId(uj.upload_id);
    setState('processing');
    const pr = await fetch('/api/menu/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upload_id: uj.upload_id }) });
    const pj = await pr.json();
    if (!pr.ok || !pj?.ok) { setError(pj?.error || 'Process failed'); setState('error'); return; }
    setParsed(pj.parsed); setState('ready');
  };

  const onCommit = async () => {
    if (!uploadId) return;
    setState('committing'); setError(null);
    const cr = await fetch('/api/menu/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upload_id: uploadId }) });
    const cj = await cr.json();
    if (!cr.ok || !cj?.ok) { setError(cj?.error || 'Commit failed'); setState('error'); return; }
    setState('done');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload PDF Menu</CardTitle>
        <CardDescription>Upload, parse and preview a PDF menu. OCR is used only if needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="flex gap-2">
          <Button onClick={onUpload} disabled={!file || state==='uploading' || state==='processing'}>
            {state==='uploading' ? 'Uploading...' : state==='processing' ? 'Processing...' : 'Upload & Process'}
          </Button>
          <Button onClick={onCommit} disabled={state!=='ready'}>
            Commit to Menu
          </Button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {parsed && (
          <div className="max-h-80 overflow-auto border rounded p-2 text-sm">
            {parsed.categories?.map((cat: any, i: number) => (
              <div key={i} className="mb-3">
                <div className="font-semibold">{cat.name}</div>
                <ul className="list-disc ml-5">
                  {cat.items?.map((it: any, j: number) => (
                    <li key={j}>{it.name} — £{Number(it.unit_price).toFixed(2)} {it.description ? `– ${it.description}` : ''}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


