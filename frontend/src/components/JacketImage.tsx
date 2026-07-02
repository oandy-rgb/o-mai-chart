import { useState } from 'preact/hooks'

const JACKET_BASE_URL = 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/jacket/'

interface JacketImageProps {
    imageName?: string | null
    title?: string
    class?: string
    loading?: 'eager' | 'lazy'
    crossOrigin?: 'anonymous' | 'use-credentials'
}

export function jacketUrl(imageName?: string | null) {
    return imageName ? `${JACKET_BASE_URL}${imageName}` : ''
}

export default function JacketImage({
    imageName,
    title = '',
    class: className = 'w-full h-full object-cover',
    loading = 'lazy',
    crossOrigin,
}: JacketImageProps) {
    const [failed, setFailed] = useState(false)
    const src = jacketUrl(imageName)

    if (!src || failed) {
        return (
            <div
            class={`flex h-full w-full items-center justify-center bg-gray-800 text-center text-[10px] font-bold leading-tight text-gray-400 ${className}`}
            aria-label={title ? `${title} jacket unavailable` : 'Jacket unavailable'}
            >
                <span class="line-clamp-2 px-2">{title || 'NO IMAGE'}</span>
            </div>
        )
    }

    return (
        <img
        src={src}
        alt={title}
        class={className}
        loading={loading}
        decoding="async"
        crossOrigin={crossOrigin}
        onError={() => setFailed(true)}
        />
    )
}
