import { loadLocalRecords } from './localRecords';
import { courierSeedRecords, machineSeedRecords } from './operationsSeedData';
import { getOperatorOptions } from './userProfiles';

export const storeUserOptions = getOperatorOptions();

const manualCourierStorageKey = 'nexus-manual-couriers';
const machinesStorageKey = 'nexus-module-machines';

export function getManualCourierNames() {
  const couriers = loadLocalRecords(manualCourierStorageKey, courierSeedRecords);

  return couriers
    .map((courier) => courier?.name?.trim())
    .filter(Boolean);
}

export function getMachineOptions() {
  const machines = loadLocalRecords(machinesStorageKey, machineSeedRecords);
  const labels = machines
    .map((machine) => machine?.device?.trim())
    .filter(Boolean);

  return Array.from(new Set(['Sem maquininha', ...labels]));
}

export function getStoreMemberOptions() {
  return Array.from(new Set([...storeUserOptions, ...getManualCourierNames()]));
}
