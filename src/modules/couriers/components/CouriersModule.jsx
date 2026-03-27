import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import SurfaceCard from '../../../components/common/SurfaceCard'
import { useConfirm } from '../../../hooks/useConfirm'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../contexts/AuthContext'
import { useStore } from '../../../contexts/StoreContext'
import { firebaseReady } from '../../../services/firebase'
import {
  deleteCourierRecord,
  MANUAL_COURIER_STORAGE_KEY,
  saveCourier,
  subscribeToCouriers,
} from '../../../services/courierService'
import { appendAuditEvent } from '../../../services/localAudit'
import {
  loadLocalRecords,
  loadResettableLocalRecords,
  saveLocalRecords,
} from '../../../services/localAccess'
import { courierSeedRecords, machineSeedRecords } from '../../../services/operationsSeedData'
import {
  saveManualModuleRecord,
  subscribeToManualModuleRecords,
} from '../../../services/manualModuleService'
import { courierShiftOptions, courierStatusOptions } from '../schemas/courierSchema'
import { findCourierById } from '../utils/courierFilters'
import { countCouriersByStatus, filterCouriers } from '../utils/courierFilters'
import CouriersFilters from './CouriersFilters'
import CouriersGrid from './CouriersGrid'
import CouriersStats from './CouriersStats'
import Select from '../../../components/ui/Select'
import { playDestructive, playError } from '../../../services/soundManager'

const initialFilters = {
  search: '',
  status: 'all',
  shift: 'all',
  fixedOnly: false,
}

const initialCourierForm = {
  name: '',
  phone: '',
  vehicle: '',
  machine: 'Sem maquininha',
  shift: 'night',
  status: 'available',
  isFixed: false,
  notes: '',
}

function buildMachineOptions(machineRecords) {
  return Array.from(
    new Set(machineRecords.map((machine) => machine?.device?.trim()).filter(Boolean)),
  )
}

function CouriersModule({ mode = 'lookup', editingCourierId = null, onFinishEditing }) {
  const { session } = useAuth()
  const { currentStoreId, tenantId } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [filters, setFilters] = useState(initialFilters)
  const [manualCouriers, setManualCouriers] = useState(() =>
    loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, courierSeedRecords),
  )
  const [machineRecords, setMachineRecords] = useState(() =>
    loadLocalRecords('nexus-module-machines', machineSeedRecords),
  )
  const [scheduleRecords, setScheduleRecords] = useState(() =>
    loadResettableLocalRecords('nexus-module-schedule', [], 3),
  )
  const [form, setForm] = useState(initialCourierForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const canSyncCouriers = Boolean(firebaseReady && currentStoreId)

  useEffect(
    () =>
      subscribeToCouriers(
        currentStoreId,
        (records) => {
          setManualCouriers(records)
          setErrorMessage('')
        },
        () => {
          setErrorMessage('Nao foi possivel sincronizar os entregadores com a base compartilhada.')
        },
      ),
    [currentStoreId],
  )

  useEffect(
    () =>
      subscribeToManualModuleRecords({
        storeId: currentStoreId,
        modulePath: 'machines',
        storageKey: 'nexus-module-machines',
        initialRecords: machineSeedRecords,
        onData: (records) => {
          setMachineRecords(records)
        },
        onError: () => {
          setErrorMessage(
            (current) => current || 'Nao foi possivel sincronizar as maquininhas da operacao.',
          )
        },
      }),
    [currentStoreId],
  )

  useEffect(
    () =>
      subscribeToManualModuleRecords({
        storeId: currentStoreId,
        modulePath: 'schedule',
        storageKey: 'nexus-module-schedule',
        initialRecords: [],
        dailyResetHour: 3,
        onData: (records) => {
          setScheduleRecords(records)
        },
      }),
    [currentStoreId],
  )

  useEffect(() => {
    saveLocalRecords(MANUAL_COURIER_STORAGE_KEY, manualCouriers)
  }, [manualCouriers])

  const couriers = useMemo(() => manualCouriers, [manualCouriers])

  const filteredCouriers = useMemo(() => filterCouriers(couriers, filters), [couriers, filters])
  const machineOptions = useMemo(() => buildMachineOptions(machineRecords), [machineRecords])
  const activeScheduleCouriers = useMemo(
    () => new Set(scheduleRecords.map((record) => record?.courier?.trim()).filter(Boolean)),
    [scheduleRecords],
  )
  const activeDeliveryCouriers = useMemo(
    () =>
      new Set(
        scheduleRecords
          .filter((record) =>
            String(record?.status ?? '')
              .toLowerCase()
              .includes('rota'),
          )
          .map((record) => record?.courier?.trim())
          .filter(Boolean),
      ),
    [scheduleRecords],
  )
  const editingCourier = useMemo(
    () => (editingCourierId ? findCourierById(couriers, editingCourierId) : null),
    [couriers, editingCourierId],
  )
  const groupedCouriers = useMemo(() => {
    const groups = {
      active: [],
      available: [],
      off: [],
    }

    filteredCouriers.forEach((courier) => {
      const courierName = courier.name?.trim()
      const isOnDelivery =
        courier.status === 'on_route' || (courierName && activeDeliveryCouriers.has(courierName))
      const isScheduled = courierName && activeScheduleCouriers.has(courierName)

      if (isOnDelivery) {
        groups.active.push(courier)
        return
      }

      if (isScheduled) {
        groups.available.push(courier)
        return
      }

      groups.off.push(courier)
    })

    return groups
  }, [activeDeliveryCouriers, activeScheduleCouriers, filteredCouriers])

  useEffect(() => {
    setCollapsedGroups((current) => ({
      ...current,
      off: groupedCouriers.off.length > 5 ? (current.off ?? true) : false,
    }))
  }, [groupedCouriers.off.length])

  const courierGroups = useMemo(
    () => [
      {
        id: 'active',
        title: 'EM ENTREGA AGORA',
        tone: 'info',
        couriers: groupedCouriers.active,
        collapsed: false,
        collapsible: false,
      },
      {
        id: 'available',
        title: 'DISPONIVEL NO TURNO',
        tone: 'success',
        couriers: groupedCouriers.available,
        collapsed: false,
        collapsible: false,
      },
      {
        id: 'off',
        title: 'FORA DO TURNO / SEM ESCALA',
        tone: 'neutral',
        couriers: groupedCouriers.off,
        collapsed: groupedCouriers.off.length > 5 ? Boolean(collapsedGroups.off) : false,
        collapsible: groupedCouriers.off.length > 5,
      },
    ],
    [collapsedGroups.off, groupedCouriers],
  )

  const stats = useMemo(
    () => [
      {
        id: 'all',
        label: 'Total',
        value: couriers.length,
        meta: 'entregadores monitorados',
      },
      {
        id: 'active',
        label: 'Ativos',
        value:
          countCouriersByStatus(couriers, 'available') +
          countCouriersByStatus(couriers, 'on_route'),
        meta: 'na escala de hoje',
      },
      {
        id: 'fixed',
        label: 'Fixos',
        value: couriers.filter((courier) => courier.isFixed).length,
        meta: 'permanentes',
      },
      {
        id: 'advances',
        label: 'Vales',
        value: 0,
        meta: 'pendentes',
      },
    ],
    [couriers],
  )

  useEffect(() => {
    if (mode !== 'register') {
      return
    }

    if (editingCourierId && editingCourier) {
      setForm({
        name: editingCourier.name ?? '',
        phone: editingCourier.phone ?? '',
        vehicle: editingCourier.vehicle ?? '',
        machine: editingCourier.machine ?? 'Sem maquininha',
        shift: editingCourier.shift ?? 'night',
        status: editingCourier.status ?? 'available',
        isFixed: Boolean(editingCourier.isFixed),
        notes: editingCourier.notes ?? '',
      })
      return
    }

    if (!editingCourierId) {
      setForm(initialCourierForm)
    }
  }, [editingCourier, editingCourierId, mode])

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function persistCourierRecord(nextCourier, isEditing) {
    try {
      if (canSyncCouriers) {
        await saveCourier({
          storeId: currentStoreId,
          tenantId,
          courier: nextCourier,
        })
        return 'remote'
      }
    } catch {
      // Fall back to local persistence when the shared base is unavailable.
    }

    setManualCouriers((current) =>
      isEditing
        ? current.map((courier) => (courier.id === nextCourier.id ? nextCourier : courier))
        : [nextCourier, ...current],
    )
    return 'local'
  }

  async function syncMachineAssignments(previousCourier, nextCourier) {
    if (!nextCourier?.name) {
      return
    }

    const previousMachine = previousCourier?.machine ?? 'Sem maquininha'
    const nextMachine = nextCourier.machine ?? 'Sem maquininha'
    const nextAssignments = machineRecords.map((machine) => {
      if (
        previousMachine !== 'Sem maquininha' &&
        machine.device === previousMachine &&
        machine.holder === (previousCourier?.name ?? nextCourier.name)
      ) {
        return {
          ...machine,
          holder: 'Sem entregador',
        }
      }

      if (nextMachine !== 'Sem maquininha' && machine.device === nextMachine) {
        return {
          ...machine,
          holder: nextCourier.name,
        }
      }

      return machine
    })

    setMachineRecords(nextAssignments)
    saveLocalRecords('nexus-module-machines', nextAssignments)

    if (!firebaseReady || !currentStoreId) {
      return
    }

    const changedRecords = nextAssignments.filter((machine, index) => {
      const currentMachine = machineRecords[index]

      return (
        currentMachine &&
        (currentMachine.holder !== machine.holder ||
          currentMachine.status !== machine.status ||
          currentMachine.model !== machine.model)
      )
    })

    try {
      await Promise.all(
        changedRecords.map((machine) =>
          saveManualModuleRecord({
            storeId: currentStoreId,
            tenantId,
            modulePath: 'machines',
            storageKey: 'nexus-module-machines',
            record: {
              ...machine,
              updatedAt: new Intl.DateTimeFormat('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date()),
              updatedBy: session?.operatorName ?? session?.displayName ?? 'Operador local',
            },
          }),
        ),
      )
    } catch {
      // Keep the local assignment when shared sync is unavailable.
    }
  }

  function handleCancelEditing() {
    setForm(initialCourierForm)
    onFinishEditing?.()
  }

  function handleToggleGroup(groupId) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const timestamp = new Date().toISOString()
    const isEditing = Boolean(editingCourierId && editingCourier)

    const newCourier = {
      id: isEditing ? editingCourier.id : `manual-${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim() || 'Nao informado',
      vehicle: form.vehicle.trim() || 'Moto',
      machine: form.machine.trim() || 'Sem maquininha',
      status: form.status,
      shift: form.shift,
      isFixed: form.isFixed,
      rating: editingCourier?.rating ?? 5.0,
      deliveriesToday: editingCourier?.deliveriesToday ?? 0,
      weeklyDeliveries: editingCourier?.weeklyDeliveries ?? 0,
      notes: form.notes.trim() || 'Cadastro manual realizado pela operacao.',
      timeline: [
        {
          id: `timeline-${Date.now()}`,
          time: 'Agora',
          label: isEditing
            ? 'Cadastro atualizado no modulo de entregadores'
            : 'Cadastro manual concluido no modulo de entregadores',
        },
        ...(editingCourier?.timeline ?? []),
      ].slice(0, 8),
      createdAtClient: editingCourier?.createdAtClient ?? timestamp,
      updatedAtClient: timestamp,
    }

    try {
      const persistenceMode = await persistCourierRecord(newCourier, isEditing)
      await syncMachineAssignments(editingCourier, newCourier)
      setForm(initialCourierForm)
      setErrorMessage('')
      appendAuditEvent({
        module: 'Entregadores',
        modulePath: 'couriers',
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: isEditing ? 'Atualizou entregador' : 'Cadastrou entregador',
        target: newCourier.name,
        details: isEditing
          ? `Cadastro atualizado com maquininha fixa ${newCourier.machine}`
          : persistenceMode === 'remote'
            ? 'Cadastro sincronizado com a base compartilhada'
            : 'Cadastro manual realizado no modulo de entregadores',
      })
      onFinishEditing?.()
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel salvar o entregador.')
    }
  }

  async function handleDelete(courierId) {
    const courier = manualCouriers.find((item) => item.id === courierId)
    const confirmed = await confirm.ask({
      title: 'Remover entregador',
      message: `Confirma a exclusao do cadastro de ${courier?.name ?? 'entregador'}?`,
      confirmLabel: 'Remover entregador',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    try {
      if (canSyncCouriers) {
        await deleteCourierRecord({
          storeId: currentStoreId,
          courierId,
        })
      }
    } catch {
      // Fall back to local deletion when the shared base is unavailable.
    }

    try {
      setManualCouriers((current) => current.filter((item) => item.id !== courierId))
      setErrorMessage('')
      appendAuditEvent({
        module: 'Entregadores',
        modulePath: 'couriers',
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Excluiu entregador',
        target: courier?.name ?? 'Entregador',
        details: 'Cadastro removido do modulo de entregadores',
      })
      toast.success(`Entregador ${courier?.name ?? ''} removido`)
      playDestructive()
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel excluir o entregador.')
      playError()
    }
  }

  function renderLookup() {
    return (
      <div className="couriers-layout">
        <div className="couriers-layout__main">
          <SurfaceCard title="Base de entregadores">
            <div className="couriers-panel">
              <div className="couriers-panel__header">
                <div>
                  <p className="text-overline">Consulta operacional</p>
                  <h3 className="text-section-title">Leitura rapida do time</h3>
                  <p className="text-body">
                    Busque por nome, turno, status ou maquininha fixa e abra o perfil do entregador
                    sem disputar espaco com o cadastro.
                  </p>
                </div>
                <div className="couriers-panel__header-actions">
                  <Link
                    to="/history?modulo=couriers&data=hoje"
                    className="native-module__history-link"
                  >
                    Ver historico do time
                  </Link>
                  <span className="ui-badge ui-badge--special">
                    {filteredCouriers.length} de {couriers.length}
                  </span>
                </div>
              </div>

              <CouriersFilters filters={filters} onChange={setFilters} />
              <CouriersGrid
                couriers={filteredCouriers}
                groups={courierGroups}
                onDelete={handleDelete}
                onToggleGroup={handleToggleGroup}
              />
            </div>
          </SurfaceCard>
        </div>

        <aside className="couriers-layout__aside">
          <SurfaceCard title="Resumo da base">
            <div className="couriers-aside-list">
              <div className="couriers-aside-list__item">
                <span>Ativos hoje</span>
                <strong>{stats[1]?.value ?? 0} em operacao</strong>
              </div>
              <div className="couriers-aside-list__item">
                <span>Fixos</span>
                <strong>{stats[2]?.value ?? 0} permanentes</strong>
              </div>
              <div className="couriers-aside-list__item">
                <span>Persistencia</span>
                <strong>{canSyncCouriers ? 'Base compartilhada' : 'Base local'}</strong>
              </div>
            </div>
          </SurfaceCard>
        </aside>
      </div>
    )
  }

  function renderRegister() {
    return (
      <div className="couriers-layout">
        <div className="couriers-layout__main">
          <SurfaceCard title={editingCourier ? 'Editar entregador' : 'Cadastrar entregador'}>
            <div className="couriers-register">
              <div className="couriers-register__intro">
                <p className="text-overline">
                  {editingCourier ? 'Edicao dedicada' : 'Cadastro dedicado'}
                </p>
                <h3 className="text-section-title">
                  {editingCourier
                    ? `Ajustes de ${editingCourier.name}`
                    : 'Entrada limpa para novos nomes'}
                </h3>
                <p className="text-body">
                  {editingCourier
                    ? 'Atualize telefone, turno, status e maquininha fixa sem sair da tela de cadastro.'
                    : 'Preencha os dados operacionais em uma tela focada, sem cards de consulta competindo com o formulario.'}
                </p>
              </div>

              <form className="couriers-register__form" onSubmit={handleSubmit}>
                <div className="ui-field couriers-register__field--wide">
                  <label className="ui-label" htmlFor="courier-name">
                    Nome
                  </label>
                  <input
                    id="courier-name"
                    className="ui-input"
                    type="text"
                    value={form.name}
                    placeholder="Nome do entregador"
                    required
                    onChange={(event) => updateField('name', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-phone-register">
                    Telefone
                  </label>
                  <input
                    id="courier-phone-register"
                    className="ui-input"
                    type="text"
                    value={form.phone}
                    placeholder="(37) 99999-0000"
                    onChange={(event) => updateField('phone', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-vehicle">
                    Veiculo
                  </label>
                  <input
                    id="courier-vehicle"
                    className="ui-input"
                    type="text"
                    value={form.vehicle}
                    placeholder="Moto"
                    onChange={(event) => updateField('vehicle', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-machine-register">
                    Maquininha fixa
                  </label>
                  <Select
                    id="courier-machine-register"
                    className="ui-select"
                    value={form.machine}
                    onChange={(event) => updateField('machine', event.target.value)}
                  >
                    <option value="Sem maquininha">Sem maquininha</option>
                    {machineOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-shift-register">
                    Turno
                  </label>
                  <Select
                    id="courier-shift-register"
                    className="ui-select"
                    value={form.shift}
                    onChange={(event) => updateField('shift', event.target.value)}
                  >
                    {courierShiftOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-status-register">
                    Status
                  </label>
                  <Select
                    id="courier-status-register"
                    className="ui-select"
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                  >
                    {courierStatusOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="ui-field couriers-register__field--wide">
                  <label className="ui-label" htmlFor="courier-notes">
                    Observacoes
                  </label>
                  <textarea
                    id="courier-notes"
                    className="ui-textarea"
                    rows={4}
                    value={form.notes}
                    placeholder="Detalhes curtos sobre disponibilidade, preferencia de rota ou observacao do turno."
                    onChange={(event) => updateField('notes', event.target.value)}
                  />
                </div>

                <label className="couriers-filters__checkbox couriers-register__checkbox couriers-register__field--wide">
                  <input
                    type="checkbox"
                    checked={form.isFixed}
                    onChange={(event) => updateField('isFixed', event.target.checked)}
                  />
                  <span>Entregador fixo</span>
                </label>

                <div className="couriers-register__actions couriers-register__field--wide">
                  {editingCourier ? (
                    <button
                      type="button"
                      className="ui-button ui-button--ghost"
                      onClick={handleCancelEditing}
                    >
                      Cancelar edicao
                    </button>
                  ) : null}
                  <button type="submit" className="ui-button ui-button--primary">
                    {editingCourier ? 'Salvar alteracoes' : 'Cadastrar entregador'}
                  </button>
                </div>
              </form>
            </div>
          </SurfaceCard>
        </div>

        <aside className="couriers-layout__aside">
          <SurfaceCard title="Resumo de cadastro">
            <div className="couriers-aside-list">
              <div className="couriers-aside-list__item">
                <span>Total atual</span>
                <strong>{stats[0]?.value ?? 0} entregadores na base</strong>
              </div>
              <div className="couriers-aside-list__item">
                <span>Fixos</span>
                <strong>{stats[2]?.value ?? 0} permanentes</strong>
              </div>
              <div className="couriers-aside-list__item">
                <span>Persistencia</span>
                <strong>{canSyncCouriers ? 'Base compartilhada' : 'Base local'}</strong>
              </div>
            </div>
          </SurfaceCard>
        </aside>
      </div>
    )
  }

  return (
    <section className="couriers-module">
      <section className="couriers-overview">
        <div className="couriers-overview__header">
          <div>
            <p className="text-overline">Panorama da base</p>
            <h3 className="text-section-title">Visao geral dos entregadores</h3>
          </div>
          <span className="ui-badge ui-badge--info">
            {canSyncCouriers ? 'Base compartilhada' : 'Base local'}
          </span>
        </div>

        <CouriersStats items={stats} />
      </section>
      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
      {mode === 'register' ? renderRegister() : renderLookup()}
    </section>
  )
}

export default CouriersModule
