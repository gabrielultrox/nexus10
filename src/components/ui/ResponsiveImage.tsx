import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react'

type ResponsiveSource = {
  type: string
  srcSet: string
  sizes?: string
}

export interface IResponsiveImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  sources?: ResponsiveSource[]
  pictureClassName?: string
  placeholder?: string
}

function ResponsiveImage({
  src,
  alt,
  sources = [],
  className = '',
  pictureClassName = '',
  placeholder,
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  ...props
}: IResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <picture
      className={['ui-responsive-image', isLoaded ? 'is-loaded' : 'is-loading', pictureClassName]
        .filter(Boolean)
        .join(' ')}
      style={
        placeholder
          ? ({ ['--ui-image-placeholder' as string]: `url("${placeholder}")` } as CSSProperties)
          : undefined
      }
    >
      {sources.map((source) => (
        <source
          key={`${source.type}-${source.srcSet}`}
          type={source.type}
          srcSet={source.srcSet}
          sizes={source.sizes}
        />
      ))}
      <img
        {...props}
        src={src}
        alt={alt}
        className={['ui-responsive-image__img', className].filter(Boolean).join(' ')}
        loading={loading}
        decoding={decoding}
        onLoad={(event) => {
          setIsLoaded(true)
          onLoad?.(event)
        }}
      />
    </picture>
  )
}

export default ResponsiveImage
