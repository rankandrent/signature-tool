
import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { addSignatureToPdf } from './services/pdfService';
import { SignatureSettings, FileData, ProcessingStatus } from './types';
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
  HelpCircle
} from 'lucide-react';

// Setup PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

// Reusable Tooltip Component
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
        <div className="bg-slate-800 text-white text-[10px] font-medium py-1.5 px-3 rounded shadow-xl whitespace-nowrap border border-slate-700">
          {text}
        </div>
        <div className={`w-0 h-0 border-4 ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};

// Component to render a real PDF page thumbnail
const PagePreview: React.FC<{ pdfDoc: any; pageIndex: number }> = ({ pdfDoc, pageIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const renderPage = async () => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 0.5 }); // Thumbnail scale
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('Error rendering PDF page:', err);
      }
    };

    renderPage();
    return () => { isMounted = false; };
  }, [pdfDoc, pageIndex]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
    </div>
  );
};

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<FileData | null>(null);
  const [pdfjsDoc, setPdfjsDoc] = useState<any>(null);
  const [sigFile, setSigFile] = useState<FileData | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rangeInput, setRangeInput] = useState<string>('');
  
  const [settings, setSettings] = useState<SignatureSettings>({
    x: 400,
    y: 50,
    scale: 15,
    opacity: 1,
    mode: 'all',
    selectedPages: []
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Load for pdf-lib (metadata/processing)
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const count = pdfDoc.getPageCount();
        
        // Load for pdf.js (rendering)
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const loadedPdf = await loadingTask.promise;
        
        setPdfjsDoc(loadedPdf);
        setPageCount(count);
        setPdfFile({
          file,
          previewUrl: URL.createObjectURL(file)
        });
        setSettings(prev => ({ 
          ...prev, 
          selectedPages: Array.from({ length: count }, (_, i) => i) 
        }));
        setErrorMessage('');
      } catch (err) {
        setErrorMessage('Failed to read PDF file.');
        console.error(err);
      }
    } else {
      setErrorMessage('Please upload a valid PDF file.');
    }
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      setSigFile({
        file,
        previewUrl: URL.createObjectURL(file)
      });
      setErrorMessage('');
    } else {
      setErrorMessage('Please upload a valid PNG or JPG image for the signature.');
    }
  };

  const togglePageSelection = (index: number) => {
    setSettings(prev => {
      const isSelected = prev.selectedPages.includes(index);
      const newSelected = isSelected 
        ? prev.selectedPages.filter(p => p !== index) 
        : [...prev.selectedPages, index].sort((a, b) => a - b);
      
      return { 
        ...prev, 
        selectedPages: newSelected,
        mode: 'custom' 
      };
    });
  };

  const handleRangeApply = () => {
    if (!rangeInput) return;
    const parts = rangeInput.split(',').map(p => p.trim());
    const selected: number[] = [];
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i > 0 && i <= pageCount) selected.push(i - 1);
          }
        }
      } else {
        const num = Number(part);
        if (!isNaN(num) && num > 0 && num <= pageCount) selected.push(num - 1);
      }
    });

    const uniqueSelected = Array.from(new Set(selected)).sort((a, b) => a - b);
    setSettings(prev => ({ ...prev, selectedPages: uniqueSelected, mode: 'custom' }));
  };

  const isPageSigned = (idx: number) => {
    if (settings.mode === 'all') return true;
    if (settings.mode === 'last') return idx === pageCount - 1;
    return settings.selectedPages.includes(idx);
  };

  const processPdf = async () => {
    if (!pdfFile || !sigFile) return;

    setStatus(ProcessingStatus.PROCESSING);
    try {
      const pdfBuffer = await pdfFile.file.arrayBuffer();
      const sigBuffer = await sigFile.file.arrayBuffer();
      
      const modifiedPdfBytes = await addSignatureToPdf(
        pdfBuffer,
        sigBuffer,
        sigFile.file.type,
        settings
      );

      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed_${pdfFile.file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus(ProcessingStatus.COMPLETED);
    } catch (err) {
      console.error(err);
      setErrorMessage('An error occurred during PDF processing.');
      setStatus(ProcessingStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 py-3 px-6 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Files className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Bulk PDF Signer Pro</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Professional Multi-Page Signature Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {pdfFile && (
               <Tooltip text="Total number of pages found in the PDF">
                 <div className="hidden md:flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                   <span className="text-xs font-bold text-blue-700">{pageCount} Pages Loaded</span>
                 </div>
               </Tooltip>
             )}
             <Tooltip text="Generate and download the signed PDF" position="bottom">
              <button
                onClick={processPdf}
                disabled={!pdfFile || !sigFile || status === ProcessingStatus.PROCESSING}
                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                  !pdfFile || !sigFile || status === ProcessingStatus.PROCESSING
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95'
                }`}
              >
                {status === ProcessingStatus.PROCESSING ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {status === ProcessingStatus.PROCESSING ? 'Processing...' : 'Download Signed PDF'}
              </button>
             </Tooltip>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r border-slate-200 overflow-y-auto p-5 space-y-6 hidden lg:block shrink-0 shadow-sm">
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Layout className="w-3 h-3" /> Input Files
            </h2>
            
            <Tooltip text="Click to upload the document you want to sign" position="right">
              <div 
                onClick={() => pdfInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${pdfFile ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/50 border-blue-200 hover:border-blue-400'}`}
              >
                <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                {pdfFile ? (
                  <div className="flex items-center gap-3 text-left">
                    <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-slate-700">{pdfFile.file.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{pageCount} pages</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Upload PDF</p>
                  </>
                )}
              </div>
            </Tooltip>

            <Tooltip text="Click to upload your signature image (PNG/JPG)" position="right">
              <div 
                onClick={() => sigInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${sigFile ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/50 border-blue-200 hover:border-blue-400'}`}
              >
                <input ref={sigInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleSigUpload} />
                {sigFile ? (
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 bg-white rounded border flex items-center justify-center p-1 shrink-0">
                      <img src={sigFile.previewUrl} className="max-h-full max-w-full" alt="Sig" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-slate-700">Signature Loaded</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Upload Signature</p>
                  </>
                )}
              </div>
            </Tooltip>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CheckSquare className="w-3 h-3" /> Page Selection
            </h2>
            
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <Tooltip text="Apply signature to every page">
                  <button
                    onClick={() => setSettings(s => ({ ...s, mode: 'all' }))}
                    className={`w-full text-[10px] font-bold uppercase py-1.5 rounded ${settings.mode === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    All
                  </button>
                </Tooltip>
                <Tooltip text="Apply signature to only the last page">
                  <button
                    onClick={() => setSettings(s => ({ ...s, mode: 'last' }))}
                    className={`w-full text-[10px] font-bold uppercase py-1.5 rounded ${settings.mode === 'last' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Last
                  </button>
                </Tooltip>
                <Tooltip text="Specify specific pages or ranges">
                  <button
                    onClick={() => setSettings(s => ({ ...s, mode: 'custom' }))}
                    className={`w-full text-[10px] font-bold uppercase py-1.5 rounded ${settings.mode === 'custom' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Custom
                  </button>
                </Tooltip>
              </div>

              {settings.mode === 'custom' && (
                <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex gap-2">
                    <Tooltip text="Enter page numbers (e.g. 1, 3-5)" position="right">
                      <input 
                        type="text" 
                        placeholder="e.g. 1, 3-5, 10" 
                        value={rangeInput}
                        onChange={(e) => setRangeInput(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </Tooltip>
                    <Tooltip text="Apply the range selection">
                      <button 
                        onClick={handleRangeApply}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 active:scale-95"
                      >
                        Apply
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-3 h-3" /> Position & Scale
            </h2>
            
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Tooltip text="Horizontal position from the left (points)">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      X-Axis <HelpCircle className="w-2 h-2" />
                    </label>
                  </Tooltip>
                  <span className="text-[10px] font-mono text-blue-600">{settings.x}pt</span>
                </div>
                <input 
                  type="range" min="0" max="600" step="1"
                  value={settings.x} 
                  onChange={(e) => setSettings({...settings, x: Number(e.target.value)})}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Tooltip text="Vertical position from the bottom (points)">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      Y-Axis <HelpCircle className="w-2 h-2" />
                    </label>
                  </Tooltip>
                  <span className="text-[10px] font-mono text-blue-600">{settings.y}pt</span>
                </div>
                <input 
                  type="range" min="0" max="800" step="1"
                  value={settings.y} 
                  onChange={(e) => setSettings({...settings, y: Number(e.target.value)})}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Tooltip text="Adjust signature size percentage">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      Scale <HelpCircle className="w-2 h-2" />
                    </label>
                  </Tooltip>
                  <span className="text-[10px] font-mono text-blue-600">{settings.scale}%</span>
                </div>
                <input 
                  type="range" min="1" max="100" step="1"
                  value={settings.scale} 
                  onChange={(e) => setSettings({...settings, scale: Number(e.target.value)})}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          </section>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-red-700">{errorMessage}</p>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto bg-slate-100 flex flex-col custom-scrollbar">
          {!pdfFile ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center rotate-3 hover:rotate-0 transition-transform cursor-pointer" onClick={() => pdfInputRef.current?.click()}>
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Ready to sign multiple pages?</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">Upload any PDF and see the real pages appear in the workspace below.</p>
              </div>
              <button 
                onClick={() => pdfInputRef.current?.click()}
                className="bg-white border border-slate-200 px-6 py-3 rounded-xl font-bold text-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                Browse Files
              </button>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 px-8 py-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" /> Workspace Preview
                </h3>
                
                <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                  <Tooltip text="Decrease preview size" position="bottom">
                    <button onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} className="p-1 hover:bg-slate-100 rounded transition-colors">
                      <ZoomOut className="w-4 h-4 text-slate-600" />
                    </button>
                  </Tooltip>
                  <span className="text-xs font-mono font-bold text-slate-700 w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Tooltip text="Increase preview size" position="bottom">
                    <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="p-1 hover:bg-slate-100 rounded transition-colors">
                      <ZoomIn className="w-4 h-4 text-slate-600" />
                    </button>
                  </Tooltip>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <Tooltip text="Reset zoom" position="bottom">
                    <button onClick={() => setZoom(1)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                      <RotateCcw className="w-4 h-4 text-slate-600" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="p-8 flex-1">
                <div 
                  className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12 transition-all duration-300 ease-in-out"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                >
                  {Array.from({ length: pageCount }).map((_, idx) => {
                    const signed = isPageSigned(idx);
                    return (
                      <div key={idx} className="space-y-2 group">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                          <span className={signed ? 'text-blue-600' : ''}>Page {idx + 1}</span>
                          <Tooltip text={signed ? "Unselect page" : "Select page"} position="left">
                            <button onClick={() => togglePageSelection(idx)} className={`transition-colors ${signed ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                              {signed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                          </Tooltip>
                        </div>
                        
                        <div 
                          onClick={() => togglePageSelection(idx)}
                          className={`aspect-[1/1.414] bg-white rounded-lg shadow-sm border relative overflow-hidden transition-all duration-300 cursor-pointer ${
                            signed ? 'ring-2 ring-blue-500 ring-offset-4 border-transparent shadow-xl' : 'border-slate-200 grayscale-[0.5] opacity-80'
                          }`}
                        >
                          {/* REAL PDF PAGE RENDERING */}
                          {pdfjsDoc && <PagePreview pdfDoc={pdfjsDoc} pageIndex={idx} />}

                          {/* SIGNATURE OVERLAY */}
                          {signed && sigFile && (
                            <div 
                              className="absolute pointer-events-none transition-all duration-200 ease-out border border-blue-400/30 bg-blue-400/5"
                              style={{
                                left: `${(settings.x / 612) * 100}%`,
                                bottom: `${(settings.y / 792) * 100}%`,
                                width: `${settings.scale}%`,
                                height: 'auto',
                                opacity: settings.opacity,
                              }}
                            >
                              <img src={sigFile.previewUrl} alt="Signature" className="w-full h-full object-contain filter drop-shadow-md" />
                            </div>
                          )}

                          <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${signed ? 'opacity-0' : 'bg-slate-50/50 group-hover:opacity-100 opacity-0'}`}>
                             <p className="bg-white px-3 py-1.5 rounded-full shadow-lg text-[10px] font-bold text-slate-600 border border-slate-100">Toggle Signature</p>
                          </div>
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
    </div>
  );
};

export default App;
