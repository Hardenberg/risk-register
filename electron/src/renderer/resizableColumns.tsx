import { useCallback, type MouseEvent as ReactMouseEvent } from 'react'

interface ResizableColumnTitleProps {
  label: string
  onResizeStart: (event: ReactMouseEvent<HTMLElement>) => void
}

export function ResizableColumnTitle ({
  label,
  onResizeStart
}: ResizableColumnTitleProps): React.JSX.Element {
  return (
    <span className="resizable-column-title">
      <span className="resizable-column-label">{label}</span>
      <span
        className="column-resize-handle"
        role="separator"
        aria-label={`${label} Spaltenbreite ändern`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onMouseDown={onResizeStart}
      />
    </span>
  )
}

export function useColumnResize<K extends string> (
  columnWidths: Record<K, number>,
  setColumnWidth: (column: K, width: number) => void,
  minWidth = 84
): (column: K, event: ReactMouseEvent<HTMLElement>) => void {
  return useCallback((column: K, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column] ?? minWidth
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (moveEvent: MouseEvent): void => {
      const nextWidth = Math.max(minWidth, Math.round(startWidth + moveEvent.clientX - startX))
      setColumnWidth(column, nextWidth)
    }

    const onMouseUp = (): void => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [columnWidths, minWidth, setColumnWidth])
}

export function sumColumnWidths<T extends string> (columnWidths: Record<T, number>): number {
  return Object.keys(columnWidths).reduce((sum, key) => sum + columnWidths[key as T], 0)
}
