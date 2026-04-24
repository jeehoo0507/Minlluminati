interface Props {
  name?: string | null
  image?: string | null
  size?: number
  className?: string
}

export function Avatar({ name, image, size = 32, className = '' }: Props) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? ''}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-secondary font-semibold select-none ${className}`}
    >
      {initials}
    </div>
  )
}
