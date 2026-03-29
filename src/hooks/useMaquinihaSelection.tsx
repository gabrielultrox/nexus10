import { useEffect, useMemo, useState } from 'react'

function toUniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)))
}

export function useMaquinihaSelection(visibleIds: string[] = []) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const normalizedVisibleIds = useMemo(() => toUniqueIds(visibleIds), [visibleIds])

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => normalizedVisibleIds.includes(id)))
  }, [normalizedVisibleIds])

  const selectedCount = selectedIds.length
  const allVisibleSelected =
    normalizedVisibleIds.length > 0 && normalizedVisibleIds.every((id) => selectedIds.includes(id))
  const someVisibleSelected =
    normalizedVisibleIds.some((id) => selectedIds.includes(id)) && !allVisibleSelected

  function isSelected(id: string) {
    return selectedIds.includes(id)
  }

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  function clear() {
    setSelectedIds([])
  }

  function selectAll(ids: string[]) {
    setSelectedIds(toUniqueIds(ids))
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !normalizedVisibleIds.includes(id)))
      return
    }

    setSelectedIds((current) => toUniqueIds([...current, ...normalizedVisibleIds]))
  }

  return {
    selectedIds,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    isSelected,
    toggle,
    clear,
    selectAll,
    toggleAllVisible,
  }
}

export default useMaquinihaSelection
