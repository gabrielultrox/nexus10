export function filterCouriers(couriers, filters) {
  const searchTerm = filters.search.trim().toLowerCase();

  return couriers.filter((courier) => {
    const matchesSearch =
      searchTerm.length === 0 ||
      [courier.name, courier.phone, courier.vehicle, courier.machine]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm);

    const matchesStatus = filters.status === 'all' || courier.status === filters.status;
    const matchesShift = filters.shift === 'all' || courier.shift === filters.shift;
    const matchesFixed = !filters.fixedOnly || courier.isFixed;

    return matchesSearch && matchesStatus && matchesShift && matchesFixed;
  });
}

export function countCouriersByStatus(couriers, status) {
  return couriers.filter((courier) => courier.status === status).length;
}

export function findCourierById(couriers, courierId) {
  return couriers.find((courier) => courier.id === courierId) ?? null;
}
