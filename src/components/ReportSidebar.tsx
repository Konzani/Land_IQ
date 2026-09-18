'use client'

import React from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export default function ReportSidebar({ metrics, streamContent, isGenerating }: any) {
  const exportPDF = async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    page.drawText('Land Suitability & Feasibility Assessment', { 
      x: 50, 
      y: 780, 
      size: 16, 
      font, 
      color: rgb(0.8, 0.6, 0) 
    });
    
    let yPosition = 730;
    const lines = streamContent.split('\n');
    
    for (const line of lines) {
      if (yPosition < 50) break; 
      page.drawText(line.replace(/[^a-zA-Z0-9 .,:-]/g, ''), { 
        x: 50, 
        y: yPosition, 
        size: 10, 
        font, 
        color: rgb(0, 0, 0) 
      });
      yPosition -= 15;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `agronomic_report_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-[30%] h-full p-6 flex flex-col bg-slate-800 border-l border-slate-700 overflow-y-auto">
      <h2 className="text-sm font-mono uppercase tracking-widest text-brass mb-6 border-b border-slate-700 pb-2">
        Agronomic Feasibility Engine
      </h2>

      {!metrics && !isGenerating && (
        <div className="flex-1 flex items-center justify-center border border-slate-700 border-dashed">
          <p className="text-sm text-slate-400 font-mono">Define parcel boundary to initiate extraction.</p>
        </div>
      )}

      {isGenerating && !streamContent && (
        <div className="flex items-center space-x-3 text-brass font-mono text-sm">
          <div className="w-4 h-4 border-2 border-brass border-t-transparent rounded-full animate-spin" />
          <p>Synthesizing Agronomic Data...</p>
        </div>
      )}

      {streamContent && (
        <div className="flex-1 flex flex-col">
          <div className="prose prose-invert prose-sm font-sans text-crispWhite flex-1">
            {streamContent.split('\n').map((line: string, i: number) => (
              <p key={i} className="mb-2">{line}</p>
            ))}
          </div>
          
          <button 
            onClick={exportPDF}
            className="mt-6 w-full py-3 bg-brass text-slate-900 font-mono uppercase tracking-widest text-xs font-bold hover:bg-yellow-400 transition-colors"
          >
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
