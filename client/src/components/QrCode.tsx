import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/** QR em SVG (um único path), desenhado na cor do texto. */
export default function QrCode({ value, className }: { value: string; className?: string }) {
  const { d, size } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let path = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`
      }
    }
    return { d: path, size: n }
  }, [value])

  return (
    <svg
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className={className}
      role="img"
      aria-label={`Código QR para ${value}`}
      shapeRendering="crispEdges"
    >
      <path d={d} fill="currentColor" />
    </svg>
  )
}
