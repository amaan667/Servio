'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function QrCodesClient({ venue }: { venue: { id: string; name: string | null } }) {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [size, setSize] = useState(512);
  const [previewTable, setPreviewTable] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const base = 'https://servio-production.up.railway.app';
  const urlFor = (t: number) => `${base}/order/${venue.id}?table=${t}`;

  const renderPreview = async () => {
    const c = canvasRef.current;
    if (!c) return;
    await QRCode.toCanvas(c, urlFor(previewTable), { width: size, margin: 2 });
  };

  useEffect(() => { renderPreview(); /* eslint-disable-next-line */ }, [previewTable, size]);

  const generateZip = async () => {
    const zip = new JSZip();
    for (let t = from; t <= to; t++) {
      const dataUrl = await QRCode.toDataURL(urlFor(t), { width: size, margin: 2 });
      const base64 = dataUrl.split(',')[1];
      zip.file(`table-${t}.png`, base64!, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${venue.name ?? 'venue'}-qr-t${from}-${to}.zip`);
  };

  const downloadPNG = async () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `table-${previewTable}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <h3 className="text-lg font-semibold">QR Settings</h3>
            <p className="text-sm text-gray-500">Generate table QR codes</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Table</Label>
                <Input type="number" min={1} value={from} onChange={e => setFrom(Number(e.target.value || 1))} />
              </div>
              <div>
                <Label>To Table</Label>
                <Input type="number" min={from} value={to} onChange={e => setTo(Number(e.target.value || from))} />
              </div>
            </div>
            <div>
              <Label>Preview Table</Label>
              <Input type="number" min={from} max={to} value={previewTable} onChange={e => setPreviewTable(Number(e.target.value || from))} />
            </div>
            <div>
              <Label>Size (px)</Label>
              <Input type="number" min={256} step={64} value={size} onChange={e => setSize(Number(e.target.value || 512))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={renderPreview}>Generate Preview</Button>
              <Button variant="outline" onClick={downloadPNG}>Download PNG</Button>
            </div>
            <div className="pt-2">
              <Button className="w-full" onClick={generateZip}>Bulk Download ZIP</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-lg font-semibold">Preview</h3>
            <p className="text-sm text-gray-500">Table #{previewTable}</p>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            <canvas ref={canvasRef} className="bg-white p-4 rounded shadow" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}