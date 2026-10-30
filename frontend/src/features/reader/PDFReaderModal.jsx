import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
} from 'react-pdf-highlighter'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf-highlighter/dist/style/PdfHighlighter.css'
import 'react-pdf-highlighter/dist/style/Highlight.css'
import 'react-pdf-highlighter/dist/style/AreaHighlight.css'
import 'react-pdf-highlighter/dist/style/Tip.css'
import 'react-pdf-highlighter/dist/style/MouseSelection.css'
import 'react-pdf-highlighter/dist/style/pdf_viewer.css'
import './reader.css'

/**
 * Tip shown when the user finishes selecting text in the PDF.
 * Lets them optionally add a note, then confirms or cancels the highlight.
 */
const SelectionTip = ({ onConfirm, onCancel }) => {
  const [note, setNote] = useState('')

  return (
    <div className="pdf-selection-tip">
      <input
        autoFocus
        type="text"
        placeholder="Add a note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm(note)
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="pdf-selection-tip-actions">
        <button type="button" onClick={() => onConfirm(note)}>
          Highlight
        </button>
        <button type="button" className="cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Small popup shown when hovering an existing highlight. */
const HighlightPopup = ({ comment }) =>
  comment?.text ? (
    <div className="pdf-highlight-popup">{comment.text}</div>
  ) : null

/**
 * PDFReaderModal renders the PDF using react-pdf-highlighter.
 *
 * Props:
 *   url             – blob URL of the PDF file
 *   highlights      – array of saved highlight objects (react-pdf-highlighter format)
 *   onAddHighlight  – called with a new highlight object when user confirms selection
 *   onScrollRefReady – called with the scrollTo(highlight) function once the viewer mounts
 *   onDocumentLoad  – called with (numPages) once the PDF is loaded
 */
export const PDFReaderModal = ({
  url,
  highlights,
  onAddHighlight,
  onScrollRefReady,
  onDocumentLoad,
}) => {
  const lastLoadedPagesRef = useRef(null)
  // Monkey-patch PdfHighlighter to flush highlight-layer renders synchronously.
  //
  // react-pdf-highlighter v7 renders each page's highlights into a separate
  // React 18 root (via createRoot). React 18 treats these as concurrent renders
  // and defers them, so saved highlights stay invisible until the next user
  // interaction (e.g. a click) forces React to flush. Wrapping root.render()
  // in flushSync forces React to process these renders immediately.
  const patchHighlighter = useCallback((instance) => {
    if (!instance || instance._patched) return
    if (typeof instance.renderHighlightLayer !== 'function') return

    const orig = instance.renderHighlightLayer.bind(instance)
    instance.renderHighlightLayer = (root, pageNumber) => {
      try {
        flushSync(() => orig(root, pageNumber))
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          'Failed to flush highlight layer synchronously; falling back to default render. This may indicate a React or react-pdf-highlighter compatibility issue.',
          error,
        )
        orig(root, pageNumber)
      }
    }
    instance._patched = true
  }, [])

  return (
    <div className="pdf-viewer-container">
      <PdfLoader
        url={url}
        workerSrc={workerSrc}
        beforeLoad={<div className="loading">Loading PDF…</div>}
        errorMessage={<div className="error-message">Failed to load PDF. The file may be corrupted or unsupported.</div>}
      >
        {(pdfDocument) => {
          if (lastLoadedPagesRef.current !== pdfDocument.numPages) {
            lastLoadedPagesRef.current = pdfDocument.numPages
            onDocumentLoad?.(pdfDocument.numPages)
          }
          return (
          <PdfHighlighter
            ref={patchHighlighter}
            pdfDocument={pdfDocument}
            enableAreaSelection={(event) => event.altKey}
            scrollRef={(scrollTo) => {
              onScrollRefReady?.(scrollTo)
            }}
            onSelectionFinished={(position, content, hideTipAndSelection) => (
              <SelectionTip
                onConfirm={(note) => {
                  onAddHighlight({
                    content,
                    position,
                    comment: { text: note.trim(), emoji: '' },
                  })
                  hideTipAndSelection()
                }}
                onCancel={hideTipAndSelection}
              />
            )}
            highlightTransform={(
              highlight,
              index,
              setTip,
              hideTip,
              _viewportToScaled,
              _screenshot,
              isScrolledTo,
            ) => {
              const isTextHighlight = !highlight.content?.image

              const component = isTextHighlight ? (
                <Highlight
                  isScrolledTo={isScrolledTo}
                  position={highlight.position}
                  comment={highlight.comment}
                />
              ) : (
                <AreaHighlight
                  isScrolledTo={isScrolledTo}
                  highlight={highlight}
                  onChange={() => {}}
                />
              )

              return (
                <Popup
                  popupContent={<HighlightPopup comment={highlight.comment} />}
                  onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
                  onMouseOut={hideTip}
                  key={highlight.id || index}
                >
                  {component}
                </Popup>
              )
            }}
            highlights={highlights}
          />
          )
        }}
      </PdfLoader>
    </div>
  )
}

export default PDFReaderModal
