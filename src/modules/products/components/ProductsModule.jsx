import { useEffect, useMemo, useState } from 'react'

import MetricCard from '../../../components/common/MetricCard'
import SurfaceCard from '../../../components/common/SurfaceCard'
import { useAuth } from '../../../contexts/AuthContext'
import { useStore } from '../../../contexts/StoreContext'
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog'
import { seedBaseProducts } from '../../../services/baseDataSeed'
import { firebaseReady } from '../../../services/firebase'
import { analyzeProductCatalog } from '../../../services/productCatalogAudit'
import {
  applyMinimumStockDefaults,
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  normalizeProductCategories,
  subscribeToProducts,
  updateProduct,
} from '../../../services/productService'
import { playError, playSuccess } from '../../../services/soundManager'

const initialFormState = {
  name: '',
  category: '',
  price: '',
  cost: '',
  stock: '',
  minimumStock: '0',
  sku: '',
  status: 'active',
  description: '',
}

const initialBulkState = {
  category: '',
  minimumStock: '',
  status: 'keep',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0))
}

function mapProductToForm(product) {
  return {
    name: product.name ?? '',
    category: product.category ?? '',
    price: String(product.price ?? ''),
    cost: String(product.cost ?? ''),
    stock: String(product.stock ?? ''),
    minimumStock: String(product.minimumStock ?? 0),
    sku: product.sku ?? '',
    status: product.status ?? 'active',
    description: product.description ?? '',
  }
}

function buildIssueBadges(product, auditSets) {
  const badges = []

  if (Number(product.price ?? 0) <= 0) {
    badges.push({ label: 'Sem preco', tone: 'ui-badge--warning' })
  }

  if (Number(product.cost ?? 0) <= 0) {
    badges.push({ label: 'Sem custo', tone: 'ui-badge--special' })
  }

  if (Number(product.minimumStock ?? 0) <= 0) {
    badges.push({ label: 'Sem minimo', tone: 'ui-badge--danger' })
  }

  if (auditSets.duplicateSkuIds.has(product.id)) {
    badges.push({ label: 'SKU duplicado', tone: 'ui-badge--info' })
  }

  if (auditSets.suspiciousNameIds.has(product.id)) {
    badges.push({ label: 'Texto suspeito', tone: 'ui-badge--warning' })
  }

  if (auditSets.uncategorizedIds.has(product.id)) {
    badges.push({ label: 'Sem categoria', tone: 'ui-badge--danger' })
  }

  return badges
}

function ProductsModule() {
  const { can, session } = useAuth()
  const { currentStoreId, tenantId } = useStore()
  const [products, setProducts] = useState([])
  const [formState, setFormState] = useState(initialFormState)
  const [bulkState, setBulkState] = useState(initialBulkState)
  const [editingProductId, setEditingProductId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState('all')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [fixingMinimums, setFixingMinimums] = useState(false)
  const [normalizingCategories, setNormalizingCategories] = useState(false)
  const [applyingBulkEdit, setApplyingBulkEdit] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setErrorMessage('')

    const unsubscribe = subscribeToProducts(
      currentStoreId,
      (nextProducts) => {
        setProducts(nextProducts)
        setLoading(false)
      },
      (error) => {
        setErrorMessage(error.message)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [currentStoreId])

  const catalogAudit = useMemo(() => analyzeProductCatalog(products), [products])
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  )
  const auditSets = useMemo(() => ({
    suspiciousNameIds: new Set(catalogAudit.possibleEncodingIssues.map((product) => product.id)),
    duplicateSkuIds: new Set(catalogAudit.duplicateSkuGroups.flat().map((product) => product.id)),
    duplicateNameIds: new Set(catalogAudit.duplicateNameGroups.flat().map((product) => product.id)),
    uncategorizedIds: new Set(catalogAudit.uncategorized.map((product) => product.id)),
  }), [catalogAudit])

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        product.name,
        product.category,
        product.sku,
        product.barcode,
      ].join(' ').toLowerCase().includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter
      const matchesQuality = qualityFilter === 'all'
        || (qualityFilter === 'missing-price' && Number(product.price ?? 0) <= 0)
        || (qualityFilter === 'missing-cost' && Number(product.cost ?? 0) <= 0)
        || (qualityFilter === 'missing-minimum' && Number(product.minimumStock ?? 0) <= 0)
        || (qualityFilter === 'duplicate-sku' && auditSets.duplicateSkuIds.has(product.id))
        || (qualityFilter === 'duplicate-name' && auditSets.duplicateNameIds.has(product.id))
        || (qualityFilter === 'suspicious' && auditSets.suspiciousNameIds.has(product.id))
        || (qualityFilter === 'uncategorized' && auditSets.uncategorizedIds.has(product.id))

      return matchesSearch && matchesCategory && matchesStatus && matchesQuality
    })
  }, [auditSets, categoryFilter, products, qualityFilter, searchTerm, statusFilter])

  useEffect(() => {
    setSelectedProductIds((current) => current.filter((productId) => products.some((product) => product.id === productId)))
  }, [products])

  const metrics = useMemo(() => {
    const activeProducts = products.filter((product) => product.status === 'active').length
    const lowStock = products.filter((product) => Number(product.stock ?? 0) <= Number(product.minimumStock ?? 0)).length
    const inventoryValue = products.reduce(
      (total, product) => total + Number(product.stock ?? 0) * Number(product.cost ?? 0),
      0,
    )

    return [
      { label: 'Produtos', value: String(products.length).padStart(2, '0'), meta: 'base cadastrada na store atual', badgeText: 'real', badgeClass: 'ui-badge--info' },
      { label: 'Ativos', value: String(activeProducts).padStart(2, '0'), meta: 'disponiveis para uso no PDV', badgeText: 'online', badgeClass: 'ui-badge--success' },
      { label: 'Estoque baixo', value: String(lowStock).padStart(2, '0'), meta: 'produtos abaixo do estoque minimo', badgeText: 'alerta', badgeClass: 'ui-badge--warning' },
      { label: 'Custo em estoque', value: formatCurrency(inventoryValue), meta: 'custo consolidado da base atual', badgeText: 'financeiro', badgeClass: 'ui-badge--special' },
    ]
  }, [products])

  function updateField(field, value) {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  function updateBulkField(field, value) {
    setBulkState((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setFormState(initialFormState)
    setEditingProductId(null)
  }

  function resetBulkForm() {
    setBulkState(initialBulkState)
  }

  function clearFeedback() {
    setFeedbackMessage('')
    setErrorMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.')
      playError()
      return
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para salvar produtos.')
      playError()
      return
    }

    setSaving(true)
    clearFeedback()

    try {
      if (editingProductId) {
        await updateProduct({ storeId: currentStoreId, productId: editingProductId, values: formState })
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'product.updated',
          entityType: 'product',
          entityId: editingProductId,
          description: `Produto ${formState.name} atualizado no catalogo.`,
        })
        setFeedbackMessage('Produto atualizado com sucesso.')
      } else {
        const productId = await createProduct({ storeId: currentStoreId, tenantId, values: formState })
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'product.created',
          entityType: 'product',
          entityId: productId,
          description: `Produto ${formState.name} criado no catalogo.`,
        })
        setFeedbackMessage('Produto cadastrado com sucesso.')
      }

      playSuccess()
      resetForm()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setSaving(false)
    }
  }

  async function handleSeedProducts() {
    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.')
      playError()
      return
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para popular produtos.')
      playError()
      return
    }

    setSeeding(true)
    clearFeedback()

    try {
      const result = await seedBaseProducts({ storeId: currentStoreId, tenantId, existingProducts: products })
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'product.seeded',
        entityType: 'product',
        entityId: 'base-seed',
        description: `Base inicial de produtos processada com ${result.createdCount} novos itens.`,
      })
      setFeedbackMessage(result.createdCount > 0 ? `${result.createdCount} produtos iniciais adicionados.` : 'A base inicial de produtos ja esta completa.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setSeeding(false)
    }
  }

  async function handleApplyMinimumStockDefaults() {
    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.')
      playError()
      return
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para higienizar a base.')
      playError()
      return
    }

    setFixingMinimums(true)
    clearFeedback()

    try {
      const result = await applyMinimumStockDefaults({ storeId: currentStoreId, tenantId, products })
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'product.minimum_stock_fixed',
        entityType: 'product',
        entityId: 'bulk-minimum-stock',
        description: `${result.updatedCount} produto(s) receberam estoque minimo padrao.`,
      })
      setFeedbackMessage(result.updatedCount > 0 ? `${result.updatedCount} produto(s) receberam estoque minimo padrao.` : 'Nenhum produto precisava de estoque minimo padrao.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setFixingMinimums(false)
    }
  }

  async function handleNormalizeCategories() {
    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.')
      playError()
      return
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para higienizar a base.')
      playError()
      return
    }

    setNormalizingCategories(true)
    clearFeedback()

    try {
      const result = await normalizeProductCategories({ storeId: currentStoreId, tenantId, products })
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'product.category_normalized',
        entityType: 'product',
        entityId: 'bulk-category-normalization',
        description: `${result.updatedCount} produto(s) tiveram a categoria padronizada.`,
      })
      setFeedbackMessage(result.updatedCount > 0 ? `${result.updatedCount} produto(s) tiveram a categoria padronizada.` : 'As categorias ja estavam padronizadas.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setNormalizingCategories(false)
    }
  }

  async function handleApplyBulkEdit() {
    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.')
      playError()
      return
    }

    if (!currentStoreId || selectedProductIds.length === 0) {
      setErrorMessage('Selecione pelo menos um produto para editar em lote.')
      playError()
      return
    }

    const changes = {}

    if (bulkState.category.trim()) {
      changes.category = bulkState.category
    }

    if (bulkState.minimumStock.trim()) {
      changes.minimumStock = bulkState.minimumStock
    }

    if (bulkState.status !== 'keep') {
      changes.status = bulkState.status
    }

    if (Object.keys(changes).length === 0) {
      setErrorMessage('Preencha pelo menos um campo da edicao em lote.')
      playError()
      return
    }

    setApplyingBulkEdit(true)
    clearFeedback()

    try {
      const result = await bulkUpdateProducts({
        storeId: currentStoreId,
        tenantId,
        productIds: selectedProductIds,
        products,
        changes,
      })

      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'product.bulk_updated',
        entityType: 'product',
        entityId: 'bulk-edit',
        description: `${result.updatedCount} produto(s) atualizados em lote.`,
      })

      setSelectedProductIds([])
      resetBulkForm()
      setFeedbackMessage(`${result.updatedCount} produto(s) atualizados em lote.`)
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    } finally {
      setApplyingBulkEdit(false)
    }
  }

  function handleEdit(product) {
    setEditingProductId(product.id)
    setFormState(mapProductToForm(product))
    clearFeedback()
  }

  async function handleDelete(productId) {
    const product = products.find((item) => item.id === productId)

    if (!currentStoreId || !window.confirm('Deseja excluir este produto?')) {
      return
    }

    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.')
      playError()
      return
    }

    clearFeedback()

    try {
      await deleteProduct({ storeId: currentStoreId, productId })
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'product.deleted',
        entityType: 'product',
        entityId: productId,
        description: `Produto ${product?.name ?? productId} excluido do catalogo.`,
      })

      if (editingProductId === productId) {
        resetForm()
      }

      setSelectedProductIds((current) => current.filter((id) => id !== productId))
      setFeedbackMessage('Produto excluido com sucesso.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    }
  }

  function toggleProductSelection(productId) {
    setSelectedProductIds((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ))
  }

  function toggleVisibleSelection() {
    const visibleIds = visibleProducts.map((product) => product.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((productId) => selectedProductIds.includes(productId))

    setSelectedProductIds((current) => {
      if (allVisibleSelected) {
        return current.filter((productId) => !visibleIds.includes(productId))
      }

      return Array.from(new Set([...current, ...visibleIds]))
    })
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Produtos">
        <div className="module-empty-state">
          <p className="module-empty-state__text">Firebase nao configurado</p>
        </div>
      </SurfaceCard>
    )
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Produtos">
        <div className="module-empty-state">
          <p className="module-empty-state__text">Nenhuma store ativa</p>
        </div>
      </SurfaceCard>
    )
  }

  return (
    <section className="entity-module">
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

      <SurfaceCard title="Higiene da base">
        <div className="entity-toolbar-shell">
          <div className="entity-toolbar-copy">
            <p className="text-section-title">Auditoria da importacao</p>
            <p className="text-body">Revise duplicidades, texto suspeito, categoria e estoque minimo antes de usar o catalogo no PDV.</p>
          </div>
          <div className="entity-form-actions entity-form-actions--inline">
            <button type="button" className="ui-button ui-button--ghost" onClick={handleNormalizeCategories} disabled={normalizingCategories || !can('catalog:write')}>
              {normalizingCategories ? 'Padronizando...' : 'Padronizar categorias'}
            </button>
            <button type="button" className="ui-button ui-button--ghost" onClick={handleApplyMinimumStockDefaults} disabled={fixingMinimums || !can('catalog:write')}>
              {fixingMinimums ? 'Corrigindo...' : 'Corrigir estoque minimo'}
            </button>
          </div>
        </div>

        <div className="card-grid">
          <MetricCard label="Nomes suspeitos" value={String(catalogAudit.possibleEncodingIssues.length).padStart(2, '0')} meta="itens com possivel problema de texto" badgeText="texto" badgeClass="ui-badge--warning" />
          <MetricCard label="Minimo zerado" value={String(catalogAudit.zeroMinimumStock.length).padStart(2, '0')} meta="produtos com saldo positivo e sem minimo" badgeText="estoque" badgeClass="ui-badge--special" />
          <MetricCard label="SKU duplicado" value={String(catalogAudit.duplicateSkuGroups.length).padStart(2, '0')} meta="grupos com codigo repetido" badgeText="sku" badgeClass="ui-badge--info" />
          <MetricCard label="Categoria vazia" value={String(catalogAudit.uncategorized.length).padStart(2, '0')} meta="itens sem categoria definida" badgeText="catalogo" badgeClass="ui-badge--danger" />
        </div>

        <div className="entity-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Diagnostico</th>
                <th>Exemplo</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="ui-table__cell--strong">Nomes com texto suspeito</td>
                <td>{catalogAudit.possibleEncodingIssues[0]?.name ?? '-'}</td>
                <td className="ui-table__cell--numeric">{catalogAudit.possibleEncodingIssues.length}</td>
              </tr>
              <tr>
                <td className="ui-table__cell--strong">Produtos com minimo zerado</td>
                <td>{catalogAudit.zeroMinimumStock[0]?.name ?? '-'}</td>
                <td className="ui-table__cell--numeric">{catalogAudit.zeroMinimumStock.length}</td>
              </tr>
              <tr>
                <td className="ui-table__cell--strong">Grupos de SKU duplicado</td>
                <td>{catalogAudit.duplicateSkuGroups[0]?.map((product) => product.sku || product.name).join(' / ') ?? '-'}</td>
                <td className="ui-table__cell--numeric">{catalogAudit.duplicateSkuGroups.length}</td>
              </tr>
              <tr>
                <td className="ui-table__cell--strong">Grupos de nome duplicado</td>
                <td>{catalogAudit.duplicateNameGroups[0]?.map((product) => product.name).join(' / ') ?? '-'}</td>
                <td className="ui-table__cell--numeric">{catalogAudit.duplicateNameGroups.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <SurfaceCard title={editingProductId ? 'Editar produto' : 'Cadastrar produto'}>
        <div className="entity-form-shell">
          <div className="entity-form-shell__header">
            <div className="entity-form-hero">
              <span className="entity-form-hero__eyebrow">Catalogo ativo</span>
              <h4 className="entity-form-hero__title">{editingProductId ? 'Atualize o produto em foco' : 'Cadastre produtos com um fluxo mais direto'}</h4>
              <p className="entity-form-hero__description">Organize preco, custo, estoque e classificacao em um fluxo claro para a operacao ganhar velocidade no cadastro.</p>
              <div className="entity-form-hero__chips">
                <span className="ui-badge ui-badge--info">SKU pronto para PDV</span>
                <span className="ui-badge ui-badge--warning">Controle de minimo</span>
                <span className="ui-badge ui-badge--special">Base por loja</span>
              </div>
            </div>

            <div className="entity-form-aside">
              <div className="entity-form-aside__card">
                <span className="entity-form-aside__label">Produtos ativos</span>
                <strong>{String(metrics[1]?.value ?? '00')}</strong>
                <p className="text-body">Itens disponiveis agora para uso no PDV e nos pedidos.</p>
              </div>
              <div className="entity-form-aside__card">
                <span className="entity-form-aside__label">Estoque baixo</span>
                <strong>{String(metrics[2]?.value ?? '00')}</strong>
                <p className="text-body">Produtos que merecem revisao antes de faltar no turno.</p>
              </div>
            </div>
          </div>

          <div className="entity-form-actions entity-form-actions--inline">
            <button type="button" className="ui-button ui-button--ghost" onClick={handleSeedProducts} disabled={seeding || saving || !can('catalog:write')}>
              {seeding ? 'Preparando base...' : 'Popular base inicial'}
            </button>
          </div>

          <form className="entity-form-grid" onSubmit={handleSubmit}>
            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Identidade</span>
                <h4 className="entity-form-section__title">Informacoes principais</h4>
              </div>

              <div className="entity-stack">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-name">Nome</label>
                  <input id="product-name" className="ui-input" value={formState.name} onChange={(event) => updateField('name', event.target.value)} />
                  <span className="entity-field-hint">Use um nome curto e facil de reconhecer durante a venda.</span>
                </div>
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-category">Categoria</label>
                  <input id="product-category" className="ui-input" value={formState.category} onChange={(event) => updateField('category', event.target.value)} />
                  <span className="entity-field-hint">Ajuda na organizacao da base e nos filtros da operacao.</span>
                </div>
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-sku">SKU</label>
                  <input id="product-sku" className="ui-input" value={formState.sku} onChange={(event) => updateField('sku', event.target.value)} />
                  <span className="entity-field-hint">Codigo interno para consulta rapida, importacoes e conferencia.</span>
                </div>
              </div>
            </div>

            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Preco e saldo</span>
                <h4 className="entity-form-section__title">Camada comercial</h4>
              </div>

              <div className="entity-stack">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-price">Preco</label>
                  <input id="product-price" className="ui-input" value={formState.price} onChange={(event) => updateField('price', event.target.value)} placeholder="0.00" />
                </div>
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-cost">Custo</label>
                  <input id="product-cost" className="ui-input" value={formState.cost} onChange={(event) => updateField('cost', event.target.value)} placeholder="0.00" />
                </div>
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-stock">Estoque</label>
                  <input id="product-stock" className="ui-input" value={formState.stock} onChange={(event) => updateField('stock', event.target.value)} placeholder="0" />
                </div>
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-minimum-stock">Estoque minimo</label>
                  <input id="product-minimum-stock" className="ui-input" value={formState.minimumStock} onChange={(event) => updateField('minimumStock', event.target.value)} placeholder="0" />
                </div>
                <div className="ui-field">
                  <label className="ui-label" htmlFor="product-status">Status</label>
                  <select id="product-status" className="ui-select" value={formState.status} onChange={(event) => updateField('status', event.target.value)}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Apoio</span>
                <h4 className="entity-form-section__title">Descricao operacional</h4>
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="product-description">Descricao</label>
                <textarea id="product-description" className="ui-textarea" rows={4} value={formState.description} onChange={(event) => updateField('description', event.target.value)} />
              </div>
            </div>

            <div className="entity-form-actions entity-form-grid__wide">
              {editingProductId ? (
                <button type="button" className="ui-button ui-button--ghost" onClick={resetForm}>
                  Cancelar edicao
                </button>
              ) : null}
              <button type="submit" className="ui-button ui-button--primary" disabled={saving || !can('catalog:write')}>
                {saving ? 'Salvando...' : editingProductId ? 'Salvar produto' : 'Cadastrar produto'}
              </button>
            </div>
          </form>
        </div>

        {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
      </SurfaceCard>

      <SurfaceCard title="Lista completa da loja">
        <div className="entity-toolbar-shell">
          <div className="entity-toolbar-copy">
            <p className="text-section-title">Produtos com quantidade em estoque</p>
            <p className="text-body">Consulte toda a base com saude do cadastro, categoria, preco, custo e saldo atual.</p>
          </div>
          <div className="entity-toolbar">
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-search">Buscar</label>
              <input id="products-search" className="ui-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nome, categoria, SKU ou codigo de barras" />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-category-filter">Categoria</label>
              <select id="products-category-filter" className="ui-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Todas</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-status-filter">Status</label>
              <select id="products-status-filter" className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-quality-filter">Qualidade</label>
              <select id="products-quality-filter" className="ui-select" value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="missing-price">Sem preco</option>
                <option value="missing-cost">Sem custo</option>
                <option value="missing-minimum">Sem estoque minimo</option>
                <option value="duplicate-sku">SKU duplicado</option>
                <option value="duplicate-name">Nome duplicado</option>
                <option value="suspicious">Texto suspeito</option>
                <option value="uncategorized">Sem categoria</option>
              </select>
            </div>
          </div>
        </div>

        <div className="entity-toolbar-shell">
          <div className="entity-toolbar-copy">
            <p className="text-section-title">Edicao em lote simples</p>
            <p className="text-body">
              {selectedProductIds.length > 0
                ? `${selectedProductIds.length} produto(s) selecionado(s) para ajuste rapido.`
                : 'Selecione produtos na tabela para aplicar categoria, minimo ou status em lote.'}
            </p>
          </div>
          <div className="entity-toolbar">
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-bulk-category">Categoria</label>
              <input id="products-bulk-category" className="ui-input" value={bulkState.category} onChange={(event) => updateBulkField('category', event.target.value)} placeholder="Categoria padrao" />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-bulk-minimum">Estoque minimo</label>
              <input id="products-bulk-minimum" className="ui-input" value={bulkState.minimumStock} onChange={(event) => updateBulkField('minimumStock', event.target.value)} placeholder="0" />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-bulk-status">Status</label>
              <select id="products-bulk-status" className="ui-select" value={bulkState.status} onChange={(event) => updateBulkField('status', event.target.value)}>
                <option value="keep">Manter atual</option>
                <option value="active">Ativar</option>
                <option value="inactive">Inativar</option>
              </select>
            </div>
            <div className="entity-form-actions entity-form-actions--inline">
              <button type="button" className="ui-button ui-button--ghost" onClick={resetBulkForm}>
                Limpar lote
              </button>
              <button type="button" className="ui-button ui-button--primary" onClick={handleApplyBulkEdit} disabled={applyingBulkEdit || selectedProductIds.length === 0 || !can('catalog:write')}>
                {applyingBulkEdit ? 'Aplicando...' : 'Aplicar lote'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="module-empty-state">
            <p className="module-empty-state__text">Carregando produtos</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="module-empty-state">
            <p className="module-empty-state__text">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="entity-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Selecionar produtos visiveis"
                      checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedProductIds.includes(product.id))}
                      onChange={toggleVisibleSelection}
                    />
                  </th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preco</th>
                  <th>Custo</th>
                  <th>Qtd. estoque</th>
                  <th>Minimo</th>
                  <th>Status</th>
                  <th>Saude</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const issueBadges = buildIssueBadges(product, auditSets)

                  return (
                    <tr key={product.id} className={selectedProductIds.includes(product.id) ? 'entity-table__row--selected' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${product.name}`}
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                      </td>
                      <td className="ui-table__cell--strong">{product.name}</td>
                      <td>{product.category || '-'}</td>
                      <td className="ui-table__cell--numeric">{formatCurrency(product.price)}</td>
                      <td className="ui-table__cell--numeric">{formatCurrency(product.cost)}</td>
                      <td className="ui-table__cell--numeric">{product.stock}</td>
                      <td className="ui-table__cell--numeric">{product.minimumStock ?? 0}</td>
                      <td>{product.status === 'active' ? 'Ativo' : 'Inativo'}</td>
                      <td>
                        <div className="entity-table__actions">
                          {issueBadges.length === 0 ? (
                            <span className="ui-badge ui-badge--success">OK</span>
                          ) : (
                            issueBadges.slice(0, 3).map((badge) => (
                              <span key={`${product.id}-${badge.label}`} className={`ui-badge ${badge.tone}`}>
                                {badge.label}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="entity-table__actions">
                        <button type="button" className="ui-button ui-button--ghost" onClick={() => handleEdit(product)} disabled={!can('catalog:write')}>
                          Editar
                        </button>
                        <button type="button" className="ui-button ui-button--danger" onClick={() => handleDelete(product.id)} disabled={!can('catalog:write')}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </section>
  )
}

export default ProductsModule
