export function GovSeal({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-white flex items-center justify-center flex-shrink-0`}>
      <img
        src="/dict-seal.png"
        alt="DICT Seal"
        className="w-full h-full object-contain p-1"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    </div>
  )
}

export function GovHeaderLogos() {
  return (
    <div className="flex items-center gap-2">
      <img
        src="/logo/iidb_logo.png"
        alt="ILCDB"
        className="h-8 w-auto object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
      <img
        src="/logo/bagong-pilipinas.png"
        alt="Bagong Pilipinas"
        className="h-8 w-auto object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    </div>
  )
}
