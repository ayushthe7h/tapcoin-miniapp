// A generic USDT (Tether) coin mark rendered as inline SVG — no external asset
// or trademarked artwork, just the widely-recognized green circle + "T" glyph
// used to label amounts throughout the app.
export default function UsdtLogo({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        fill="#fff"
        d="M17.9 17.4v-.01c-.11.008-.68.042-1.94.042-1.01 0-1.72-.03-1.97-.042v.01c-3.24-.143-5.66-.7-5.66-1.37s2.42-1.226 5.66-1.37v2.18c.25.018.98.06 1.99.06 1.2 0 1.8-.05 1.92-.06v-2.18c3.23.144 5.65.7 5.65 1.37s-2.42 1.226-5.65 1.37zm0-2.97v-1.96h4.51V9.5H9.6v2.97h4.51v1.96c-3.67.168-6.43.892-6.43 1.76s2.76 1.59 6.43 1.76v6.3h3.79v-6.3c3.66-.168 6.42-.892 6.42-1.76s-2.76-1.59-6.42-1.76z"
      />
    </svg>
  )
}
