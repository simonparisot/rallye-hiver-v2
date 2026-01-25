import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// Configure PDF.js worker - using jsdelivr CDN with correct .mjs extension
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfUrl: string;
  title?: string;
}

// Detect Safari browser (including iOS Safari)
const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.indexOf('safari') !== -1 &&
    ua.indexOf('chrome') === -1 &&
    ua.indexOf('android') === -1
  );
};

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, title }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const isMountedRef = useRef<boolean>(true);
  const useSafariMode = useRef<boolean>(isSafari());

  // Track if component is mounted to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state when pdfUrl changes
  useEffect(() => {
    setPageNumber(1);
    setNumPages(0);
    setLoading(true);
    setError('');
  }, [pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    if (isMountedRef.current) {
      setNumPages(numPages);
      setLoading(false);
      setError('');
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF loading error:', error);
    if (isMountedRef.current) {
      setError('Erreur lors du chargement du PDF');
      setLoading(false);
    }
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  if (error && !useSafariMode.current) {
    return (
      <div className="pdf-viewer-error">
        <p>{error}</p>
        <p className="error-url">{pdfUrl}</p>
      </div>
    );
  }

  // Safari Mode: Use native iframe for better compatibility
  if (useSafariMode.current) {
    return (
      <div className="pdf-viewer-container">
        <div className="pdf-safari-viewer">
          <iframe
            src={pdfUrl}
            title={title || 'PDF Viewer'}
            className="pdf-iframe"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              minHeight: '600px',
            }}
          />
          <div className="pdf-safari-hint">
            <p>
              Vous pouvez également{' '}
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-download-link">
                ouvrir le PDF dans un nouvel onglet
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Standard Mode: Use react-pdf for Chrome/Firefox/Edge
  return (
    <div className="pdf-viewer-container">
      {/* PDF Document */}
      <div className="pdf-document-wrapper">
        {loading && (
          <div className="pdf-loading">
            <div className="loading-spinner">Chargement du PDF...</div>
          </div>
        )}

        <Document
          key={pdfUrl}
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="pdf-loading">Chargement...</div>}
          className="pdf-document"
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="pdf-page"
            width={window.innerWidth > 768 ? undefined : window.innerWidth - 40}
          />
        </Document>
      </div>

      {/* Simple page navigation at bottom - only if multiple pages */}
      {numPages > 1 && (
        <div className="pdf-simple-nav">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="pdf-simple-btn"
          >
            ← Précédent
          </button>
          <span className="pdf-page-count">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="pdf-simple-btn"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
