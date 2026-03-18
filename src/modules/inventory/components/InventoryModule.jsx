import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import { firebaseReady } from '../../../services/firebase';
import {
  adjustInventoryManually,
  importInventoryFromCsvWithMode,
  previewInventoryImport,
  subscribeToInventoryItems,
  subscribeToInventoryMovements,
} from '../../../services/inventory';
import { subscribeToProducts } from '../../../services/productService';
import { playError, playSuccess } from '../../../services/soundManager';

const initialAdjustmentState = {
  productId: '',
  movementType: 'manual_in',
  quantity: '',
  reason: '',
};

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue);
}

function isWithinPeriod(value, startDate, endDate) {
  if (!value) {
    return false;
  }

  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (dateValue < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (dateValue > end) {
      return false;
    }
  }

  return true;
}

function getMovementLabel(type) {
  switch (type) {
    case 'manual_in':
      return 'Entrada manual';
    case 'manual_out':
      return 'Saida manual';
    case 'manual_set':
      return 'Ajuste absoluto';
    case 'sale':
      return 'Baixa por venda';
    case 'sale_reversal':
      return 'Reversao de venda';
    case 'csv_import':
      return 'Importacao CSV';
    default:
      return type;
  }
}

function buildInventoryQualityBadges(item, isLowStock) {
  const badges = []

  if (isLowStock) {
    badges.push({ label: 'Baixo', tone: 'ui-badge--warning' })
  }

  if (Number(item.price ?? 0) <= 0) {
    badges.push({ label: 'Sem preco', tone: 'ui-badge--danger' })
  }

  if (Number(item.cost ?? 0) <= 0) {
    badges.push({ label: 'Sem custo', tone: 'ui-badge--special' })
  }

  if (Number(item.minimumStock ?? 0) <= 0) {
    badges.push({ label: 'Sem minimo', tone: 'ui-badge--info' })
  }

  if (item.status !== 'active') {
    badges.push({ label: 'Inativo', tone: 'ui-badge--danger' })
  }

  return badges
}

function InventoryModule() {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const [products, setProducts] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [adjustmentState, setAdjustmentState] = useState(initialAdjustmentState);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [movementSearchTerm, setMovementSearchTerm] = useState('');
  const [movementStartDate, setMovementStartDate] = useState('');
  const [movementEndDate, setMovementEndDate] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvMode, setCsvMode] = useState('all');
  const [csvPreview, setCsvPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    const unsubscribers = [
      subscribeToProducts(currentStoreId, setProducts, (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      }),
      subscribeToInventoryItems(currentStoreId, (nextItems) => {
        setInventoryItems(nextItems);
        setLoading(false);
      }, (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      }),
      subscribeToInventoryMovements(currentStoreId, setMovements, (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [currentStoreId]);

  useEffect(() => {
    if (!adjustmentState.productId && products.length > 0) {
      setAdjustmentState((current) => ({
        ...current,
        productId: products[0].id,
      }));
    }
  }, [adjustmentState.productId, products]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const inventoryMap = useMemo(
    () => new Map(inventoryItems.map((item) => [item.productId ?? item.id, item])),
    [inventoryItems],
  )
  const stockRows = useMemo(
    () => products.map((product) => {
      const inventoryItem = inventoryMap.get(product.id)

      return {
        id: product.id,
        productId: product.id,
        productName: product.name,
        category: product.category ?? '',
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        price: Number(product.price ?? 0),
        cost: Number(product.cost ?? 0),
        currentStock: Number(inventoryItem?.currentStock ?? product.stock ?? 0),
        minimumStock: Number(inventoryItem?.minimumStock ?? product.minimumStock ?? 0),
        status: product.status ?? inventoryItem?.status ?? 'active',
      }
    }),
    [inventoryMap, products],
  )

  const visibleInventoryItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stockRows.filter((item) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        item.productName,
        item.category,
        item.sku,
        item.barcode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      const isLowStock = Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'low' && isLowStock)
        || (statusFilter === 'ok' && !isLowStock);
      const matchesQuality = qualityFilter === 'all'
        || (qualityFilter === 'missing-price' && Number(item.price ?? 0) <= 0)
        || (qualityFilter === 'missing-cost' && Number(item.cost ?? 0) <= 0)
        || (qualityFilter === 'missing-minimum' && Number(item.minimumStock ?? 0) <= 0)
        || (qualityFilter === 'inactive' && item.status !== 'active');

      return matchesSearch && matchesStatus && matchesQuality;
    });
  }, [qualityFilter, searchTerm, statusFilter, stockRows]);

  const visibleMovements = useMemo(() => {
    const normalizedSearch = movementSearchTerm.trim().toLowerCase();

    return movements.filter((movement) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        movement.productName,
        movement.reason,
        getMovementLabel(movement.movementType),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      return matchesSearch && isWithinPeriod(movement.createdAt, movementStartDate, movementEndDate);
    });
  }, [movementEndDate, movementSearchTerm, movementStartDate, movements]);

  useEffect(() => {
    let isMounted = true;

    async function buildPreview() {
      if (!csvFile) {
        setCsvPreview(null);
        return;
      }

      try {
        const csvText = await csvFile.text();

        if (!isMounted) {
          return;
        }

        setCsvPreview(previewInventoryImport({
          csvText,
          products,
          mode: csvMode,
        }));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCsvPreview({
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          importedCount: 0,
          errors: [{ rowNumber: '-', reason: error.message }],
        });
      }
    }

    buildPreview();

    return () => {
      isMounted = false;
    };
  }, [csvFile, csvMode, products]);

  const metrics = useMemo(() => {
    const totalUnits = stockRows.reduce((total, item) => total + Number(item.currentStock ?? 0), 0);
    const lowStockItems = stockRows.filter(
      (item) => Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0),
    ).length;
    const inventoryCost = stockRows.reduce((total, item) => {
      const product = productMap.get(item.productId);
      return total + Number(item.currentStock ?? 0) * Number(product?.cost ?? 0);
    }, 0);

    return [
      {
        label: 'Itens monitorados',
        value: String(stockRows.length).padStart(2, '0'),
        meta: 'produtos da loja com saldo visivel',
        badgeText: 'real',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Unidades em estoque',
        value: String(totalUnits).padStart(2, '0'),
        meta: 'saldo atual consolidado',
        badgeText: 'saldo',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Estoque baixo',
        value: String(lowStockItems).padStart(2, '0'),
        meta: 'itens abaixo do minimo',
        badgeText: 'alerta',
        badgeClass: 'ui-badge--warning',
      },
      {
        label: 'Custo estimado',
        value: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(inventoryCost),
        meta: 'custo corrente da base',
        badgeText: 'custo',
        badgeClass: 'ui-badge--special',
      },
    ];
  }, [productMap, stockRows]);

  function updateAdjustmentField(field, value) {
    setAdjustmentState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleAdjustmentSubmit(event) {
    event.preventDefault();

    if (!currentStoreId) {
      return;
    }

    if (!can('inventory:write')) {
      setErrorMessage('Seu perfil nao pode alterar estoque.');
      playError();
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      const movementId = await adjustInventoryManually({
        storeId: currentStoreId,
        tenantId,
        values: adjustmentState,
      });
      const product = products.find((item) => item.id === adjustmentState.productId);
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'inventory.adjusted',
        entityType: 'inventory_movement',
        entityId: movementId,
        description: `Ajuste de estoque em ${product?.name ?? adjustmentState.productId}: ${adjustmentState.movementType} ${adjustmentState.quantity}.`,
      });

      setFeedbackMessage('Movimentacao de estoque registrada com sucesso.');
      setAdjustmentState((current) => ({
        ...initialAdjustmentState,
        productId: current.productId,
      }));
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvImport() {
    if (!currentStoreId || !csvFile) {
      setErrorMessage('Selecione um arquivo CSV para importar.');
      playError();
      return;
    }

    if (!can('inventory:write')) {
      setErrorMessage('Seu perfil nao pode importar estoque.');
      playError();
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      const csvText = await csvFile.text();
      const importResult = await importInventoryFromCsvWithMode({
        storeId: currentStoreId,
        tenantId,
        csvText,
        products,
        mode: csvMode,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'inventory.csv_imported',
        entityType: 'inventory_import',
        entityId: `csv-${Date.now()}`,
        description: [
          `${importResult.importedCount} item(ns) importados via CSV.`,
          `${importResult.createdCount} criado(s).`,
          `${importResult.updatedCount} atualizado(s).`,
          importResult.skippedCount > 0 ? `${importResult.skippedCount} ignorado(s).` : '',
        ]
          .filter(Boolean)
          .join(' '),
      });

      setFeedbackMessage([
        `${importResult.importedCount} item(ns) processados via CSV.`,
        `${importResult.createdCount} criado(s).`,
        `${importResult.updatedCount} atualizado(s).`,
        importResult.skippedCount > 0 ? `${importResult.skippedCount} ignorado(s).` : '',
      ]
        .filter(Boolean)
        .join(' '));
      setCsvFile(null);
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    } finally {
      setSaving(false);
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Estoque">
        <div className="module-empty-state">
          <p className="module-empty-state__text">Firebase nao configurado</p>
        </div>
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Estoque">
        <div className="module-empty-state">
          <p className="module-empty-state__text">Nenhuma store ativa</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module inventory-module">
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      <SurfaceCard title="Movimentar estoque">
          <div className="entity-form-shell">
            <div className="entity-form-shell__header">
              <div className="entity-form-hero">
                <span className="entity-form-hero__eyebrow">Ajuste operacional</span>
                <h4 className="entity-form-hero__title">Movimente o estoque com rapidez</h4>
                <p className="entity-form-hero__description">
                  Registre entradas, saidas e ajustes absolutos com rastreio claro.
                </p>
                <div className="entity-form-hero__chips">
                  <span className="ui-badge ui-badge--warning">Ajuste imediato</span>
                  <span className="ui-badge ui-badge--info">Historico por data</span>
                  <span className="ui-badge ui-badge--special">CSV pronto</span>
                </div>
              </div>

              <div className="entity-form-aside">
                <div className="entity-form-aside__card">
                  <span className="entity-form-aside__label">Itens monitorados</span>
                  <strong>{String(metrics[0]?.value ?? '00')}</strong>
                  <p className="text-body">Produtos acompanhados neste painel.</p>
                </div>
                <div className="entity-form-aside__card">
                  <span className="entity-form-aside__label">Saldo critico</span>
                  <strong>{String(metrics[2]?.value ?? '00')}</strong>
                  <p className="text-body">Itens que pedem acao antes de afetar a operacao.</p>
                </div>
              </div>
            </div>

            <form className="entity-form-grid inventory-form-grid" onSubmit={handleAdjustmentSubmit}>
              <div className="entity-form-section entity-form-section--span-2">
                <div className="entity-form-section__header">
                  <span className="entity-form-section__eyebrow">Movimentacao</span>
                  <h4 className="entity-form-section__title">Registro manual</h4>
                  <p className="entity-form-section__description">Selecione item, tipo e motivo.</p>
                </div>

                <div className="entity-stack">
                  <div className="ui-field">
                    <label className="ui-label" htmlFor="inventory-product">Produto</label>
                    <select
                      id="inventory-product"
                      className="ui-select"
                      value={adjustmentState.productId}
                      onChange={(event) => updateAdjustmentField('productId', event.target.value)}
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ui-field">
                    <label className="ui-label" htmlFor="inventory-movement-type">Tipo</label>
                    <select
                      id="inventory-movement-type"
                      className="ui-select"
                      value={adjustmentState.movementType}
                      onChange={(event) => updateAdjustmentField('movementType', event.target.value)}
                    >
                      <option value="manual_in">Entrada manual</option>
                      <option value="manual_out">Saida manual</option>
                      <option value="manual_set">Ajuste absoluto</option>
                    </select>
                  </div>

                  <div className="ui-field">
                    <label className="ui-label" htmlFor="inventory-quantity">Quantidade</label>
                    <input
                      id="inventory-quantity"
                      className="ui-input"
                      value={adjustmentState.quantity}
                      onChange={(event) => updateAdjustmentField('quantity', event.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="ui-field">
                    <label className="ui-label" htmlFor="inventory-reason">Motivo</label>
                    <input
                      id="inventory-reason"
                      className="ui-input"
                      value={adjustmentState.reason}
                      onChange={(event) => updateAdjustmentField('reason', event.target.value)}
                      placeholder="Reposicao, perda, conferencia, inventario..."
                    />
                    <span className="entity-field-hint">Descreva a origem do ajuste para facilitar auditoria e rastreio.</span>
                  </div>
                </div>
              </div>

              <div className="entity-form-section">
                <div className="entity-form-section__header">
                  <span className="entity-form-section__eyebrow">Importacao</span>
                  <h4 className="entity-form-section__title">Carga por CSV</h4>
                  <p className="entity-form-section__description">Ideal para conciliacao em lote.</p>
                </div>

                <div className="inventory-import">
                  <div className="inventory-import__copy">
                    <p className="text-body">Aceita codigo, nome, estoque e preco. Produtos ausentes podem ser criados no processo.</p>
                    {csvPreview ? (
                      <p className="text-body">
                        Previa: {csvPreview.importedCount} linha(s), {csvPreview.createdCount} para criar, {csvPreview.updatedCount} para atualizar e {csvPreview.skippedCount} para ignorar.
                      </p>
                    ) : null}
                  </div>
                  <div className="inventory-import__actions">
                    <select
                      className="ui-select"
                      value={csvMode}
                      onChange={(event) => setCsvMode(event.target.value)}
                    >
                      <option value="all">Criar e atualizar</option>
                      <option value="create_only">Criar novos</option>
                      <option value="update_only">Atualizar existentes</option>
                    </select>
                    <input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} />
                    <button type="button" className="ui-button ui-button--ghost" onClick={handleCsvImport} disabled={saving || !csvFile || !can('inventory:write')}>
                      Importar estoque
                    </button>
                  </div>
                  {csvPreview?.errors?.length > 0 ? (
                    <div className="entity-table-wrap entity-table-wrap--dense">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.errors.slice(0, 10).map((error) => (
                            <tr key={`${error.rowNumber}-${error.reason}`}>
                              <td>{error.rowNumber}</td>
                              <td>{error.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="entity-form-actions entity-form-grid__wide">
                <button type="submit" className="ui-button ui-button--primary" disabled={saving || !can('inventory:write')}>
                  {saving ? 'Salvando...' : 'Registrar ajuste'}
                </button>
              </div>
            </form>
          </div>

          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
        </SurfaceCard>

      <SurfaceCard title="Lista completa da loja">
          <div className="entity-toolbar-shell entity-toolbar-shell--section">
            <div className="entity-toolbar-copy">
              <p className="text-section-title">Produtos e quantidade em estoque</p>
              <p className="text-body">Leia a base da loja com saldo atual, minimo e sinais de reposicao.</p>
            </div>

            <div className="entity-toolbar inventory-toolbar">
              <div className="ui-field">
                <label className="ui-label" htmlFor="inventory-search">Buscar</label>
                <input
                  id="inventory-search"
                  className="ui-input"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Produto, categoria ou SKU"
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="inventory-status-filter">Status</label>
                <select
                  id="inventory-status-filter"
                  className="ui-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="low">Estoque baixo</option>
                  <option value="ok">Normal</option>
                </select>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="inventory-quality-filter">Qualidade</label>
                <select
                  id="inventory-quality-filter"
                  className="ui-select"
                  value={qualityFilter}
                  onChange={(event) => setQualityFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="missing-price">Sem preco</option>
                  <option value="missing-cost">Sem custo</option>
                  <option value="missing-minimum">Sem minimo</option>
                  <option value="inactive">Inativos</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="module-empty-state">
              <p className="module-empty-state__text">Carregando estoque</p>
            </div>
          ) : visibleInventoryItems.length === 0 ? (
            <div className="module-empty-state">
              <p className="module-empty-state__text">Nenhum item encontrado</p>
            </div>
          ) : (
            <div className="entity-table-wrap entity-table-wrap--dense">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>SKU</th>
                    <th>Qtd. estoque</th>
                    <th>Minimo</th>
                    <th>Saude</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInventoryItems.map((item) => {
                    const isLowStock = Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0);
                    const qualityBadges = buildInventoryQualityBadges(item, isLowStock)

                    return (
                      <tr key={item.id}>
                        <td className="ui-table__cell--strong">{item.productName}</td>
                        <td>{item.category || '-'}</td>
                        <td>{item.sku || '-'}</td>
                        <td className="ui-table__cell--numeric">{item.currentStock}</td>
                        <td className="ui-table__cell--numeric">{item.minimumStock ?? 0}</td>
                        <td>
                          <div className="entity-table__actions">
                            {qualityBadges.length === 0 ? (
                              <span className="ui-badge ui-badge--success">OK</span>
                            ) : (
                              qualityBadges.slice(0, 3).map((badge) => (
                                <span key={`${item.id}-${badge.label}`} className={`ui-badge ${badge.tone}`}>
                                  {badge.label}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>

      <SurfaceCard title="Historico de movimentacao">
        <div className="entity-toolbar-shell entity-toolbar-shell--section">
          <div className="entity-toolbar-copy">
            <p className="text-section-title">Timeline do estoque</p>
            <p className="text-body">Filtre por periodo ou texto para localizar cada ajuste.</p>
          </div>

          <div className="entity-toolbar inventory-toolbar inventory-toolbar--movements">
            <div className="ui-field">
              <label className="ui-label" htmlFor="inventory-movement-search">Buscar</label>
              <input
                id="inventory-movement-search"
                className="ui-input"
                value={movementSearchTerm}
                onChange={(event) => setMovementSearchTerm(event.target.value)}
                placeholder="Produto ou motivo"
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="inventory-movement-start">Inicio</label>
              <input
                id="inventory-movement-start"
                className="ui-input"
                type="date"
                value={movementStartDate}
                onChange={(event) => setMovementStartDate(event.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="inventory-movement-end">Fim</label>
              <input
                id="inventory-movement-end"
                className="ui-input"
                type="date"
                value={movementEndDate}
                onChange={(event) => setMovementEndDate(event.target.value)}
              />
            </div>
          </div>
        </div>

        {visibleMovements.length === 0 ? (
          <div className="module-empty-state">
            <p className="module-empty-state__text">Nenhuma movimentacao encontrada</p>
          </div>
        ) : (
          <div className="entity-table-wrap entity-table-wrap--dense">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Qtd.</th>
                  <th>Antes</th>
                  <th>Depois</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {visibleMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDateTime(movement.createdAt)}</td>
                    <td className="ui-table__cell--strong">{movement.productName}</td>
                    <td>{getMovementLabel(movement.movementType)}</td>
                    <td className="ui-table__cell--numeric">{movement.quantity}</td>
                    <td className="ui-table__cell--numeric">{movement.previousStock}</td>
                    <td className="ui-table__cell--numeric">{movement.resultingStock}</td>
                    <td>{movement.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </section>
  );
}

export default InventoryModule;
