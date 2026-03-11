function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getCurrentDateTimeLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const manualModuleConfigs = {
  schedule: {
    storageKey: 'nexus-module-schedule',
    dailyResetHour: 3,
    manualResetLabel: 'Resetar escala',
    formTitle: 'Adicionar entregador na escala',
    formDescription: 'Monte a escala do dia por entregador, janela e maquininha de apoio.',
    submitLabel: 'Adicionar na escala',
    emptyTitle: 'Nenhum entregador escalado',
    emptyDescription: 'Cadastre os entregadores da escala do dia para organizar o turno manualmente.',
    columns: ['Entregador', 'Janela', 'Maquininha', 'Status', 'Ultima atualizacao'],
    fields: [
      { name: 'courier', label: 'Entregador', type: 'select', options: [] },
      { name: 'window', label: 'Janela', placeholder: '18:00 - 22:00' },
      { name: 'machine', label: 'Maquininha', type: 'select', options: [] },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['Confirmado', 'Em rota', 'Reserva', 'Pendente'],
      },
    ],
    initialRecords: [],
    createRecord(values, context = {}) {
      return {
        id: createId('schedule'),
        courier: values.courier.trim(),
        window: values.window.trim(),
        machine: values.machine.trim() || 'Sem maquininha',
        status: values.status,
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.courier, record.window, record.machine, record.status, updateLabel];
    },
  },
  'delivery-reading': {
    storageKey: 'nexus-module-delivery-reading',
    formTitle: 'Registrar leitura de entrega',
    formDescription: 'Lance o codigo, selecione o entregador e marque se a entrega e turbo ou ja foi fechada.',
    submitLabel: 'Registrar leitura',
    emptyTitle: 'Nenhuma leitura registrada',
    emptyDescription: 'Use esta area para registrar rapidamente as entregas lidas para o time.',
    columns: ['Codigo', 'Entregador', 'Estado', 'Ultima atualizacao'],
    fields: [
      { name: 'deliveryCode', label: 'Codigo da entrega', placeholder: 'Ex: 10452', required: true },
      { name: 'courier', label: 'Entregador', type: 'select', options: [], required: true },
      {
        name: 'turbo',
        label: 'Entrega turbo',
        type: 'checkbox',
        required: false,
        description: 'Marque quando a entrega fizer parte do fluxo turbo.',
      },
      {
        name: 'closed',
        label: 'Entrega fechada',
        type: 'checkbox',
        required: false,
        description: 'Marque apenas quando a entrega ja tiver sido fechada.',
      },
    ],
    actionLabel: 'Marcar fechada',
    initialRecords: [],
    createRecord(values, context = {}) {
      const isClosed = Boolean(values.closed);
      const isTurbo = Boolean(values.turbo);

      return {
        id: createId('delivery-reading'),
        deliveryCode: values.deliveryCode.trim(),
        courier: values.courier.trim(),
        turbo: isTurbo,
        closed: isClosed,
        status: isClosed ? 'Fechada' : 'Lida',
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.deliveryCode, record.courier, record.status, updateLabel];
    },
    applyAction(record, context = {}) {
      return {
        ...record,
        closed: true,
        status: 'Fechada',
        updatedAt: context.updatedAt ?? record.updatedAt ?? '',
        updatedBy: context.updatedBy ?? record.updatedBy ?? '',
      };
    },
    getActionLabel(record) {
      return record.closed ? 'Fechada' : 'Marcar fechada';
    },
  },
  machines: {
    storageKey: 'nexus-module-machines',
    formTitle: 'Cadastrar maquininha',
    formDescription: 'Registre novas maquininhas e mantenha o parque operacional atualizado.',
    submitLabel: 'Cadastrar maquininha',
    emptyTitle: 'Nenhuma maquininha cadastrada',
    emptyDescription: 'Adicione o parque atual para acompanhar entregador, modelo e estado.',
    columns: ['Dispositivo', 'Entregador', 'Modelo', 'Estado', 'Ultima atualizacao'],
    fields: [
      { name: 'device', label: 'Dispositivo', placeholder: 'Maq. 14' },
      { name: 'holder', label: 'Entregador', type: 'select', options: [] },
      { name: 'model', label: 'Modelo', placeholder: 'Stone / Moderninha / SumUp' },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        options: ['Ativa', 'Em rota', 'Reserva', 'Carga', 'Manutencao'],
      },
    ],
    actionLabel: 'Checklist OK',
    initialRecords: [],
    createRecord(values, context = {}) {
      return {
        id: createId('machine'),
        device: values.device.trim(),
        holder: values.holder.trim() || 'Sem entregador',
        model: values.model.trim() || 'Nao informado',
        status: values.status,
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.device, record.holder, record.model, record.status, updateLabel];
    },
    applyAction(record, context = {}) {
      return {
        ...record,
        status: 'Ativa',
        updatedAt: context.updatedAt ?? record.updatedAt ?? '',
        updatedBy: context.updatedBy ?? record.updatedBy ?? '',
      };
    },
  },
  'machine-history': {
    storageKey: 'nexus-module-machine-history',
    dailyResetHour: 3,
    formTitle: 'Checklist de maquininhas',
    formDescription: 'Confirme quais maquininhas estao presentes e prontas para o dia.',
    submitLabel: 'Salvar checklist',
    emptyTitle: 'Nenhuma maquininha cadastrada',
    emptyDescription: 'Cadastre as maquininhas primeiro para montar o checklist do dia.',
    columns: ['Dispositivo', 'Entregador', 'Modelo', 'Presenca', 'Ultima atualizacao'],
    fields: [],
    initialRecords: [],
    hideForm: true,
    hideToolbar: true,
    allowDelete: false,
    allowClearAll: false,
    actionLabel: 'Checklist do dia',
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.device, record.holder, record.model, record.status, updateLabel];
    },
    applyAction(record, context = {}) {
      return {
        ...record,
        status: record.status === 'Presente' ? 'Ausente' : 'Presente',
        updatedAt: context.updatedAt ?? record.updatedAt ?? '',
        updatedBy: context.updatedBy ?? record.updatedBy ?? '',
      };
    },
    getActionLabel(record) {
      return record.status === 'Presente' ? 'Marcar ausente' : 'Marcar presente';
    },
  },
  change: {
    storageKey: 'nexus-module-change',
    formTitle: 'Registrar troco',
    formDescription: 'Controle solicitacoes, reposicoes e retornos de troco diretamente no turno.',
    submitLabel: 'Registrar troco',
    emptyTitle: 'Nenhum troco registrado',
    emptyDescription: 'Use este painel para lancar trocos liberados, pendentes ou devolvidos.',
    columns: ['Origem', 'Destino', 'Valor', 'Estado', 'Retorno'],
    fields: [
      {
        name: 'origin',
        label: 'Caixa / usuario da loja',
        type: 'select',
        options: [],
      },
      {
        name: 'destination',
        label: 'Entregador que vai retirar',
        type: 'select',
        options: [],
      },
      { name: 'value', label: 'Valor', placeholder: 'R$ 50' },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        options: ['Pendente', 'Liberado', 'Recebido', 'Retornou'],
      },
    ],
    returnActionLabel: 'OK retorno',
    initialRecords: [],
    createRecord(values) {
      return {
        id: createId('change'),
        origin: values.origin.trim(),
        destination: values.destination.trim(),
        value: values.value.trim(),
        status: values.status,
        returnedAt: '',
        returnedBy: '',
      };
    },
    toRow(record) {
      const returnLabel = record.returnedAt && record.returnedBy
        ? `${record.returnedBy} - ${record.returnedAt}`
        : 'Aguardando retorno';

      return [record.origin, record.destination, record.value, record.status, returnLabel];
    },
    markReturned(record, context = {}) {
      return {
        ...record,
        status: 'Retornou',
        returnedAt: context.returnedAt ?? record.returnedAt ?? '',
        returnedBy: context.returnedBy ?? record.returnedBy ?? '',
      };
    },
  },
  advances: {
    storageKey: 'nexus-module-advances',
    formTitle: 'Registrar vale',
    formDescription: 'Registre o vale do entregador com valor, data e motivo de forma direta.',
    submitLabel: 'Registrar vale',
    emptyTitle: 'Nenhum vale registrado',
    emptyDescription: 'Cadastre os vales do turno para acompanhar liberacao e baixa operacional.',
    columns: ['Entregador', 'Valor', 'Data', 'Motivo', 'Estado', 'Ultima atualizacao'],
    fields: [
      { name: 'recipient', label: 'Entregador', type: 'select', options: [] },
      { name: 'value', label: 'Valor (R$)', placeholder: '0,00' },
      { name: 'date', label: 'Data e hora', type: 'datetime-local', defaultValue: getCurrentDateTimeLocal },
      { name: 'reason', label: 'Motivo', placeholder: 'Ex: Vale alimentacao' },
    ],
    actionLabel: 'Baixar vale',
    initialRecords: [],
    createRecord(values, context = {}) {
      return {
        id: createId('advance'),
        recipient: values.recipient.trim(),
        value: values.value.trim(),
        date: values.date.trim(),
        reason: values.reason.trim(),
        status: 'Aguardando',
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.recipient, record.value, record.date, record.reason, record.status, updateLabel];
    },
    applyAction(record, context = {}) {
      return {
        ...record,
        status: 'Baixado',
        updatedAt: context.updatedAt ?? record.updatedAt ?? '',
        updatedBy: context.updatedBy ?? record.updatedBy ?? '',
      };
    },
  },
  discounts: {
    storageKey: 'nexus-module-discounts',
    formTitle: 'Registrar desconto',
    formDescription: 'Cadastre descontos operacionais com motivo e acompanhe o status da validacao.',
    submitLabel: 'Registrar desconto',
    emptyTitle: 'Nenhum desconto registrado',
    emptyDescription: 'Inclua os descontos do turno para consolidar motivo, valor e validacao.',
    columns: ['Pedido', 'Motivo', 'Valor', 'Status', 'Ultima atualizacao'],
    fields: [
      { name: 'order', label: 'Pedido', placeholder: '#2105' },
      { name: 'reason', label: 'Motivo', placeholder: 'Atraso / cortesia / erro operacional' },
      { name: 'value', label: 'Valor', placeholder: 'R$ 18' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['Pendente', 'Validado', 'Aprovado', 'Negado'],
      },
    ],
    actionLabel: 'Validar',
    initialRecords: [],
    createRecord(values, context = {}) {
      return {
        id: createId('discount'),
        order: values.order.trim(),
        reason: values.reason.trim(),
        value: values.value.trim(),
        status: values.status,
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.order, record.reason, record.value, record.status, updateLabel];
    },
    applyAction(record, context = {}) {
      return {
        ...record,
        status: 'Validado',
        updatedAt: context.updatedAt ?? record.updatedAt ?? '',
        updatedBy: context.updatedBy ?? record.updatedBy ?? '',
      };
    },
  },
  occurrences: {
    storageKey: 'nexus-module-occurrences',
    formTitle: 'Registrar ocorrencia',
    formDescription: 'Documente eventos operacionais com tipo, responsavel e estado de tratamento.',
    submitLabel: 'Registrar ocorrencia',
    emptyTitle: 'Nenhuma ocorrencia registrada',
    emptyDescription: 'Abra ocorrencias manuais para manter o turno rastreado e auditavel.',
    columns: ['Codigo', 'Tipo', 'Responsavel', 'Estado', 'Ultima atualizacao'],
    fields: [
      { name: 'code', label: 'Codigo', placeholder: 'Oc-301' },
      { name: 'type', label: 'Tipo', placeholder: 'Atraso / hardware / financeiro' },
      { name: 'owner', label: 'Responsavel', type: 'select', options: [] },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        options: ['Em triagem', 'Em andamento', 'Resolvida', 'Fechada'],
      },
    ],
    actionLabel: 'Resolver',
    initialRecords: [],
    createRecord(values, context = {}) {
      return {
        id: createId('occurrence'),
        code: values.code.trim(),
        type: values.type.trim(),
        owner: values.owner.trim(),
        status: values.status,
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.code, record.type, record.owner, record.status, updateLabel];
    },
    applyAction(record, context = {}) {
      return {
        ...record,
        status: 'Resolvida',
        updatedAt: context.updatedAt ?? record.updatedAt ?? '',
        updatedBy: context.updatedBy ?? record.updatedBy ?? '',
      };
    },
  },
  map: {
    storageKey: 'nexus-module-map',
    formTitle: 'Adicionar bairros sem entrega',
    formDescription: 'Cadastre os bairros em que nao ha entrega e confirme o bloqueio local.',
    submitLabel: 'Adicionar bairros',
    emptyTitle: 'Nenhum bloqueio de entrega cadastrado',
    emptyDescription: 'Inclua os bairros sem entrega para consulta rapida da operacao.',
    columns: ['Bairros', 'Nao entrega no local', 'Ultima atualizacao'],
    fields: [
      { name: 'districts', label: 'Bairros', placeholder: 'Jardim Europa, Sao Bento' },
      {
        name: 'confirmed',
        label: 'Nao entrega no local',
        type: 'select',
        options: ['Confirmado'],
      },
    ],
    initialRecords: [],
    createRecord(values, context = {}) {
      return {
        id: createId('map'),
        districts: values.districts.trim(),
        confirmed: values.confirmed,
        updatedAt: context.updatedAt ?? '',
        updatedBy: context.updatedBy ?? '',
      };
    },
    toRow(record) {
      const updateLabel = record.updatedAt && record.updatedBy
        ? `${record.updatedBy} - ${record.updatedAt}`
        : 'Sem atualizacao';

      return [record.districts, record.confirmed, updateLabel];
    },
  },
};

export function getManualModuleConfig(path) {
  return manualModuleConfigs[path] ?? null;
}
