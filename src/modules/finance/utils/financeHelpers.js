export function splitMovementsByDirection(movements) {
  return {
    income: movements.filter((movement) => movement.direction === 'in'),
    expenses: movements.filter((movement) => movement.direction === 'out'),
  }
}

export function countMovementsByDirection(movements, direction) {
  return movements.filter((movement) => movement.direction === direction).length
}
