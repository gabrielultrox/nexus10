const seedTimestamp = '2026-03-11T12:00:00.000Z';

function buildCourier(name, phone, machine, options = {}) {
  return {
    id: options.id ?? `seed-courier-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    phone,
    vehicle: options.vehicle ?? 'Moto',
    machine: machine || 'Sem maquininha',
    shift: options.shift ?? 'night',
    status: options.status ?? 'available',
    isFixed: Boolean(options.isFixed),
    rating: options.rating ?? 5,
    deliveriesToday: options.deliveriesToday ?? 0,
    weeklyDeliveries: options.weeklyDeliveries ?? 0,
    notes: options.notes ?? 'Cadastro inicial importado a partir da referencia visual da operacao.',
    timeline: [
      {
        id: `${options.id ?? `seed-courier-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}-timeline`,
        time: 'Base inicial',
        label: 'Cadastro importado para o modulo de entregadores.',
      },
    ],
    createdAtClient: seedTimestamp,
    updatedAtClient: seedTimestamp,
  };
}

function buildMachine(device, holder, options = {}) {
  return {
    id: options.id ?? `seed-machine-${device}`,
    device,
    holder: holder || 'Sem entregador',
    model: options.model ?? 'Laranjinha',
    status: options.status ?? 'Ativa',
    updatedAt: options.updatedAt ?? 'Base inicial',
    updatedBy: options.updatedBy ?? 'Codex',
    createdAtClient: seedTimestamp,
    updatedAtClient: seedTimestamp,
  };
}

export const courierSeedRecords = [
  buildCourier('Moizes', '3799591715', 'Sem maquininha', { isFixed: true }),
  buildCourier('Tito', '3798297592', 'Sem maquininha', { isFixed: true }),
  buildCourier('Arthur', '3798573157', '645'),
  buildCourier('Cabeca', '3798762207', 'Sem maquininha'),
  buildCourier('David', '3799733103', 'Sem maquininha'),
  buildCourier('Diego', '3192753947', 'Sem maquininha'),
  buildCourier('Dimas', '3791490939', 'Sem maquininha'),
  buildCourier('Eduardo Tin Tin', '3798840791', 'Sem maquininha'),
  buildCourier('Gabriel', '1212123213', '777'),
  buildCourier('Gustavo', '3796629540', '513'),
  buildCourier('Higor', '3791626291', 'Sem maquininha'),
  buildCourier('Higor (Dimas Junior)', '3791085508', 'Sem maquininha'),
  buildCourier('Jeferson', '3798227280', 'Sem maquininha'),
  buildCourier('Kelvin', '6496481817', '277'),
  buildCourier('Matheus', '3788352903', 'Sem maquininha'),
  buildCourier('Nathan', '3788498424', 'Sem maquininha'),
  buildCourier('Terra', '3799673620', '017'),
  buildCourier('Ygor Fernandes', '3791994386', 'Sem maquininha'),
];

export const machineSeedRecords = [
  buildMachine('017', 'Terra'),
  buildMachine('155', 'Sem entregador'),
  buildMachine('277', 'Kelvin'),
  buildMachine('323', 'Sem entregador'),
  buildMachine('513', 'Gustavo'),
  buildMachine('541', 'Sem entregador'),
  buildMachine('645', 'Arthur'),
  buildMachine('651', 'Sem entregador'),
  buildMachine('777', 'Gabriel'),
  buildMachine('848', 'Sem entregador'),
  buildMachine('881', 'Sem entregador'),
];
