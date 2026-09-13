/**
 * Dynamic loader for SheetJS (xlsx) from CDN with fallback to $documents.toMarkdown (backend).
 * SheetJS Community Edition exposes `window.XLSX`.
 */

declare global {
  interface Window {
    XLSX?: any
  }
}

let sheetJsLoadingPromise: Promise<any> | null = null

const SHEETJS_CDN_URLS = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
]

/**
 * Loads SheetJS into the global window object if not already available.
 */
export async function getSheetJS(): Promise<any> {
  if (typeof window !== 'undefined' && window.XLSX) {
    return window.XLSX
  }

  // If running in Node/Vitest test environment, return null or global XLSX
  if (typeof window === 'undefined') {
    return (globalThis as any).XLSX || null
  }
  if (sheetJsLoadingPromise) {
    return sheetJsLoadingPromise
  }

  sheetJsLoadingPromise = (async () => {
    for (const url of SHEETJS_CDN_URLS) {
      try {
        await loadScript(url)
        if (window.XLSX) {
          return window.XLSX
        }
      } catch (err) {
        console.warn(`[excelParser] Falha ao carregar SheetJS de ${url}:`, err)
      }
    }
    return window.XLSX || null
  })()

  return sheetJsLoadingPromise
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script tag is already in head
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if ((window as any).XLSX) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Erro ao carregar ${src}`)))
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Falha no download de ${src}`))
    document.head.appendChild(script)
  })
}
