import { useEffect, useMemo, useRef, useState } from 'react'

import Button from '../Button'

import type { IFileInputProps } from './types'

function normalizeFiles(files: FileList | File[] | null | undefined) {
  if (!files) {
    return []
  }

  return Array.from(files)
}

function createPreview(file: File) {
  if (!file.type.startsWith('image/')) {
    return null
  }

  return URL.createObjectURL(file)
}

function FileInput({
  value,
  onChange,
  accept,
  multiple = true,
  disabled = false,
  error = false,
  label = 'Arraste arquivos ou clique para selecionar',
  hint = 'PNG, JPG, PDF e anexos operacionais.',
  preview = true,
  emptyLabel = 'Nenhum arquivo anexado.',
  className = '',
  ...props
}: IFileInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [internalFiles, setInternalFiles] = useState<File[]>(value ?? [])
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    if (value) {
      setInternalFiles(value)
    }
  }, [value])

  const files = value ?? internalFiles

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: preview ? createPreview(file) : null,
      })),
    [files, preview],
  )

  useEffect(
    () => () => {
      previews.forEach((previewItem) => {
        if (previewItem.url) {
          URL.revokeObjectURL(previewItem.url)
        }
      })
    },
    [previews],
  )

  function updateFiles(nextFiles: File[]) {
    if (!value) {
      setInternalFiles(nextFiles)
    }
    onChange?.(nextFiles)
  }

  return (
    <div className={['ui-file-input', className].filter(Boolean).join(' ')} {...props}>
      <input
        ref={inputRef}
        type="file"
        className="ui-file-input__native"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(event) => updateFiles(normalizeFiles(event.target.files))}
      />
      <button
        type="button"
        className={[
          'ui-file-input__dropzone',
          isDragActive ? 'is-drag-active' : '',
          error ? 'is-error' : '',
          disabled ? 'is-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) {
            setIsDragActive(true)
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragActive(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragActive(false)
          if (disabled) {
            return
          }
          updateFiles(normalizeFiles(event.dataTransfer.files))
        }}
      >
        <span className="ui-file-input__title">{label}</span>
        <span className="ui-file-input__hint">{hint}</span>
      </button>
      <div className="ui-file-input__toolbar">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          Selecionar arquivos
        </Button>
        {files.length ? (
          <Button type="button" variant="ghost" onClick={() => updateFiles([])} disabled={disabled}>
            Limpar
          </Button>
        ) : null}
      </div>
      <div className="ui-file-input__preview-list">
        {previews.length ? (
          previews.map(({ file, url }) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="ui-file-input__preview-card"
            >
              {url ? (
                <img src={url} alt={file.name} className="ui-file-input__preview-image" />
              ) : null}
              <div className="ui-file-input__preview-copy">
                <span className="ui-file-input__preview-name">{file.name}</span>
                <span className="ui-file-input__preview-meta">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="ui-file-input__empty">{emptyLabel}</div>
        )}
      </div>
    </div>
  )
}

export default FileInput
