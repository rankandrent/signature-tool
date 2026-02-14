
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { addSignatureToPdf } from './services/pdfService';
import { SignatureSettings, FileData, ProcessingStatus, PagePosition } from './types';
import { 
  FileText, 
  Image as ImageIcon, 
  Settings, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Trash2,
  Maximize,
  Layout,
  MousePointer2,
  Crosshair,
  Files,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckSquare,
  Square,
  HelpCircle,
  Move,
  Copy,
  LayoutGrid,
  Rows,
  XCircle,
  PlusCircle,
  Scissors
} from 'lucide-react';

// Setup PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

const Tooltip: React.FC<{ text: string; children: React.ReactNode; position?: 'top' | 'bottom' | 'left' | 'right' }> = ({ text, children, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-r-slate-800 border-y-transparent border-l-transparent'
  };
  return (
    <div className="group relative flex items-center inline-block">
      {children}
      <div className={`absolute ${positionClasses[position]} hidden group-hover:flex flex-col items-center z-[100] pointer-events-none animate-in fade-in duration-200`}>
        <div className="bg-slate-800 text-white text-[10px] font-medium py-1.5 px-3 rounded shadow-xl whitespace-nowrap border border-slate-700">{text}</div>
        <div className={`w-0 h-0 border-4 ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};

const PagePreview: React.FC<{ pdfDoc: any; pageIndex: number; scale: number }> = ({ pdfDoc, pageIndex, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    const renderPage = async () => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 2.0 }); 
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        if (isMounted) setLoading(false);
      } catch (err) { console.error('Error rendering PDF page:', err); }
    };
    renderPage();
    return () => { isMounted = false; };
  }, [pdfDoc, pageIndex]);
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white pointer-events-none">
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>}
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
};

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<FileData | null>(null);
  const [pdfjsDoc, setPdfjsDoc] = useState<any>(null);
  const [sigFile, setSigFile] = useState<FileData | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<'grid' | 'document'>('document');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const [settings, setSettings] = useState<SignatureSettings>({
    globalX: 400,
    globalY: 50,
    scale: 25,
    opacity: 1,
    isGrayscale: false, // Default to color
    mode: 'all',
    selectedPages: [],
    pagePositions: {}
  });

  const [draggingPage, setDraggingPage] = useState<number | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const count = pdfDoc.getPageCount();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const loadedPdf = await loadingTask.promise;
        
        setPdfjsDoc(loadedPdf);
        setPageCount(count);
        setPdfFile({ file, previewUrl: URL.createObjectURL(file) });
        setSettings(prev => ({ 
          ...prev, 
          selectedPages: Array.from({ length: count }, (_, i) => i),
          pagePositions: {} 
        }));
        setErrorMessage('');
      } catch (err) {
        setErrorMessage('Failed to read PDF file.');
      }
    }
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      setSigFile({ file, previewUrl: URL.createObjectURL(file) });
      setErrorMessage('');
    }
  };

  const isPageSigned = (idx: number) => {
    if (settings.mode === 'all') return true;
    if (settings.mode === 'last') return idx === pageCount - 1;
    return settings.selectedPages.includes(idx);
  };

  const togglePageSelection = (index: number) => {
    setSettings(prev => {
      const isSelected = prev.selectedPages.includes(index);
      const newSelected = isSelected 
        ? prev.selectedPages.filter(p => p !== index) 
        : [...prev.selectedPages, index].sort((a, b) => a - b);
      return { ...prev, selectedPages: newSelected, mode: 'custom' };
    });
  };

  const removeSignature = (index: number) => {
    setSettings(prev => ({
      ...prev,
      selectedPages: prev.selectedPages.filter(p => p !== index),
      mode: 'custom'
    }));
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, pageIndex: number) => {
    e.stopPropagation();
    setDraggingPage(pageIndex);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (draggingPage === null) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const pageElement = document.getElementById(`pdf-page-${draggingPage}`);
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    
    const xPercent = (clientX - rect.left) / rect.width;
    const yPercent = 1 - ((clientY - rect.top) / rect.height);

    const clampedX = Math.max(0, Math.min(1, xPercent));
    const clampedY = Math.max(0, Math.min(1, yPercent));

    const pdfX = Math.round(clampedX * 612);
    const pdfY = Math.round(clampedY * 792);

    setSettings(prev => ({
      ...prev,
      pagePositions: {
        ...prev.pagePositions,
        [draggingPage]: { x: pdfX, y: pdfY }
      }
    }));
  }, [draggingPage]);

  const handleDragEnd = useCallback(() => {
    setDraggingPage(null);
  }, []);

  useEffect(() => {
    if (draggingPage !== null) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [draggingPage, handleDragMove, handleDragEnd]);

  const applyToAll = () => {
    const firstOverride = settings.pagePositions[Object.keys(settings.pagePositions)[0] as any];
    const posToUse = firstOverride || { x: settings.globalX, y: settings.globalY };
    
    const newPositions: Record<number, PagePosition> = {};
    for (let i = 0; i < pageCount; i++) {
      newPositions[i] = { ...posToUse };
    }
    setSettings(prev => ({ ...prev, pagePositions: newPositions }));
  };

  const processPdf = async () => {
    if (!pdfFile || !sigFile) return;
    setStatus(ProcessingStatus.PROCESSING);
    try {
      const pdfBuffer = await pdfFile.file.arrayBuffer();
      const sigBuffer = await sigFile.file.arrayBuffer();
      const modifiedPdfBytes = await addSignatureToPdf(pdfBuffer, sigBuffer, sigFile.file.type, settings);
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed_${pdfFile.file.name}`;
      link.click();
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err) {
      setErrorMessage('Error processing PDF.');
      setStatus(ProcessingStatus.ERROR);
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 py-2 px-6 shrink-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
            <Files className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">PDF Signature Master</h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Professional Precision Editing</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {pdfFile && (
            <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100 text-[10px] font-bold text-blue-600">
              {pageCount} Pages Loaded
            </div>
          )}
          <button 
            onClick={processPdf} 
            disabled={!pdfFile || !sigFile || status === ProcessingStatus.PROCESSING} 
            className={`px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-sm ${!pdfFile || !sigFile || status === ProcessingStatus.PROCESSING ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-transparent' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}
          >
            {status === ProcessingStatus.PROCESSING ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {status === ProcessingStatus.PROCESSING ? 'Processing...' : 'Download Final PDF'}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-8 shrink-0 z-30 flex flex-col custom-scrollbar shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
          {/* Files Section */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Layout className="w-3 h-3" /> Files
            </h2>
            
            <div 
              onClick={() => pdfInputRef.current?.click()} 
              className={`w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-blue-300 ${pdfFile ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/30 border-blue-100'}`}
            >
              <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
              {pdfFile ? (
                <div className="flex items-center gap-3 text-left">
                  <FileText className="w-6 h-6 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate text-slate-700">{pdfFile.file.name}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-slate-500">Upload PDF Document</p>
              )}
            </div>

            <div 
              onClick={() => sigInputRef.current?.click()} 
              className={`w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-blue-300 ${sigFile ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/30 border-blue-100'}`}
            >
              <input ref={sigInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleSigUpload} />
              {sigFile ? (
                <div className="flex items-center gap-3 text-left">
                  <div className="w-6 h-6 bg-white rounded border flex items-center justify-center p-0.5 shrink-0 shadow-xs">
                    <img 
                      src={sigFile.previewUrl} 
                      className="max-h-full max-w-full" 
                      style={{ filter: settings.isGrayscale ? 'grayscale(100%) contrast(120%)' : 'none' }} 
                    />
                  </div>
                  <p className="text-[11px] font-bold truncate text-slate-700">Signature Loaded</p>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-slate-500">Upload Signature Image</p>
              )}
            </div>
          </section>

          {/* Adjustments Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Settings className="w-3 h-3" /> Adjustments
              </h2>
              <Tooltip text="Sync current signature position to all pages" position="right">
                <button onClick={applyToAll} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
            
            <div className="space-y-5 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
              {/* Grayscale Toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Scissors className={`w-3.5 h-3.5 ${settings.isGrayscale ? 'text-blue-600' : 'text-slate-400'}`} />
                  <label className="text-[9px] font-black text-slate-500 uppercase cursor-pointer" htmlFor="grayscale-toggle">Black & White Mode</label>
                </div>
                <button 
                  id="grayscale-toggle"
                  onClick={() => setSettings({...settings, isGrayscale: !settings.isGrayscale})}
                  className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${settings.isGrayscale ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${settings.isGrayscale ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="h-px bg-slate-200 mx-2" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[9px] font-black text-slate-500 uppercase">Scale</label>
                  <span className="text-[9px] font-mono text-blue-600 font-bold">{settings.scale}%</span>
                </div>
                <input 
                  type="range" min="1" max="100" 
                  value={settings.scale} 
                  onChange={(e) => setSettings({...settings, scale: Number(e.target.value)})} 
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[9px] font-black text-slate-500 uppercase">Opacity</label>
                  <span className="text-[9px] font-mono text-blue-600 font-bold">{Math.round(settings.opacity * 100)}%</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={settings.opacity} 
                  onChange={(e) => setSettings({...settings, opacity: Number(e.target.value)})} 
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
              </div>
            </div>
          </section>

          {/* Info Box */}
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-3 mt-auto shadow-sm">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] text-amber-800 leading-relaxed font-semibold uppercase tracking-tight">
              Use <strong>Black & White Mode</strong> to match signature with document text color.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[10px] font-bold text-red-700 leading-tight">{errorMessage}</p>
            </div>
          )}
        </aside>

        {/* WORKSPACE AREA */}
        <main className="flex-1 overflow-y-auto bg-slate-200/40 flex flex-col custom-scrollbar relative">
          {!pdfFile ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center rotate-3 hover:rotate-0 transition-transform cursor-pointer" onClick={() => pdfInputRef.current?.click()}>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Professional Signer</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">Drag-and-drop your signature onto any page with pixel-perfect accuracy.</p>
              </div>
              <button onClick={() => pdfInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest">
                Get Started
              </button>
            </div>
          ) : (
            <>
              {/* Workspace Controls Overlay */}
              <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-md border-b border-slate-200 px-8 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Workspace</span>
                  </div>
                  <div className="h-3 w-px bg-slate-300 mx-1" />
                  <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-300/50 shadow-inner">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setViewMode('document')} className={`p-1.5 rounded-md transition-all ${viewMode === 'document' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                      <Rows className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-200/50 px-2 py-1 rounded-xl border border-slate-300/50 shadow-inner">
                  <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="p-1 hover:bg-white rounded transition-colors text-slate-600"><ZoomOut className="w-3.5 h-3.5" /></button>
                  <span className="text-[10px] font-mono font-black text-slate-800 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(Math.min(5, zoom + 0.1))} className="p-1 hover:bg-white rounded transition-colors text-slate-600"><ZoomIn className="w-3.5 h-3.5" /></button>
                  <div className="w-px h-3 bg-slate-300 mx-1" />
                  <button onClick={() => setZoom(1.0)} className="p-1 hover:bg-white rounded transition-colors text-slate-600"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Viewport for PDF Pages */}
              <div className="p-12 flex-1 flex justify-center overflow-x-auto custom-scrollbar">
                <div 
                  className={`w-full transition-all duration-300 flex flex-col items-center ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-16' : 'space-y-20'}`}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                >
                  {Array.from({ length: pageCount }).map((_, idx) => {
                    const signed = isPageSigned(idx);
                    const pos = settings.pagePositions[idx] || { x: settings.globalX, y: settings.globalY };
                    
                    return (
                      <div key={idx} className={`space-y-3 group transition-all duration-500 ${viewMode === 'document' ? 'w-full max-w-4xl' : 'w-full'}`}>
                        <div className="flex items-center justify-between px-3">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${signed ? 'text-blue-600' : 'text-slate-400'}`}>PAGE {idx + 1}</span>
                            {signed && (
                               <div className="bg-blue-600 text-[8px] text-white px-2 py-0.5 rounded-full font-black animate-in fade-in slide-in-from-left-2">SIGNED</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             {signed ? (
                               <button onClick={() => removeSignature(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 shadow-none hover:shadow-sm">
                                 <XCircle className="w-4 h-4" />
                               </button>
                             ) : (
                               <button onClick={() => togglePageSelection(idx)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 shadow-none hover:shadow-sm">
                                 <PlusCircle className="w-4 h-4" />
                               </button>
                             )}
                          </div>
                        </div>
                        
                        <div 
                          id={`pdf-page-${idx}`}
                          className={`aspect-[1/1.414] bg-white rounded-xl relative overflow-hidden transition-all duration-500 shadow-xl ${
                            signed ? 'ring-4 ring-blue-500/10 border border-blue-500' : 'border border-slate-300 opacity-80 grayscale-[0.2]'
                          }`}
                        >
                          {pdfjsDoc && <PagePreview pdfDoc={pdfjsDoc} pageIndex={idx} scale={zoom} />}

                          {/* SIGNATURE RENDER */}
                          {signed && sigFile && (
                            <div 
                              onMouseDown={(e) => handleDragStart(e, idx)}
                              onTouchStart={(e) => handleDragStart(e, idx)}
                              className={`absolute cursor-move transition-all duration-100 ${draggingPage === idx ? 'shadow-2xl ring-4 ring-blue-500/20 scale-105 border-blue-600' : 'shadow-md border-blue-500/30'} border-2 bg-white/5 hover:border-blue-500 hover:bg-blue-500/5`}
                              style={{
                                left: `${(pos.x / 612) * 100}%`,
                                bottom: `${(pos.y / 792) * 100}%`,
                                width: `${settings.scale}%`,
                                height: 'auto',
                                opacity: settings.opacity,
                                filter: settings.isGrayscale ? 'grayscale(100%) contrast(150%) brightness(90%)' : 'none'
                              }}
                            >
                              <img src={sigFile.previewUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none drop-shadow-md" />
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-2 py-0.5 rounded text-[8px] font-black shadow-lg uppercase tracking-tighter pointer-events-none">
                                MOVE ME
                              </div>
                            </div>
                          )}

                          {/* ENABLE OVERLAY */}
                          {!signed && (
                            <div onClick={() => togglePageSelection(idx)} className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/5 cursor-pointer backdrop-blur-[1px]">
                               <p className="bg-white px-4 py-2 rounded-xl shadow-2xl text-[10px] font-black text-blue-600 border border-blue-100 uppercase tracking-widest flex items-center gap-2">
                                 <PlusCircle className="w-3 h-3" /> Add Signature
                               </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; border: 2px solid transparent; background-clip: content-box; }
      `}</style>
    </div>
  );
};

export default App;
