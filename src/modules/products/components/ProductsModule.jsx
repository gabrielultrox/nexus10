import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import { firebaseReady } from '../../../services/firebase';
import {
  createProduct,
  deleteProduct,
  subscribeToProducts,
  updateProduct,
} from '../../../services/productService';
import { playError, playSuccess } from '../../../services/soundManager';

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
};

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));
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
  };
}

function ProductsModule() {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const [products, setProducts] = useState([]);
  const [formState, setFormState] = useState(initialFormState);
  const [editingProductId, setEditingProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

    const unsubscribe = subscribeToProducts(
      currentStoreId,
      (nextProducts) => {
        setProducts(nextProducts);
        setLoading(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [currentStoreId]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        product.name,
        product.category,
        product.sku,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, products, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const activeProducts = products.filter((product) => product.status === 'active').length;
    const lowStock = products.filter((product) => Number(product.stock ?? 0) <= Number(product.minimumStock ?? 0)).length;
    const inventoryValue = products.reduce(
      (total, product) => total + Number(product.stock ?? 0) * Number(product.cost ?? 0),
      0,
    );

    return [
      {
        label: 'Produtos',
        value: String(products.length).padStart(2, '0'),
        meta: 'base cadastrada na store atual',
        badgeText: 'real',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Ativos',
        value: String(activeProducts).padStart(2, '0'),
        meta: 'disponiveis para uso no PDV',
        badgeText: 'online',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Estoque baixo',
        value: String(lowStock).padStart(2, '0'),
        meta: 'produtos abaixo do estoque minimo',
        badgeText: 'alerta',
        badgeClass: 'ui-badge--warning',
      },
      {
        label: 'Custo em estoque',
        value: formatCurrency(inventoryValue),
        meta: 'custo consolidado da base atual',
        badgeText: 'financeiro',
        badgeClass: 'ui-badge--special',
      },
    ];
  }, [products]);

  function updateField(field, value) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormState(initialFormState);
    setEditingProductId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.');
      playError();
      return;
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para salvar produtos.');
      playError();
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      if (editingProductId) {
        await updateProduct({
          storeId: currentStoreId,
          productId: editingProductId,
          values: formState,
        });
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'product.updated',
          entityType: 'product',
          entityId: editingProductId,
          description: `Produto ${formState.name} atualizado no catalogo.`,
        });
        setFeedbackMessage('Produto atualizado com sucesso.');
      } else {
        const productId = await createProduct({
          storeId: currentStoreId,
          tenantId,
          values: formState,
        });
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'product.created',
          entityType: 'product',
          entityId: productId,
          description: `Produto ${formState.name} criado no catalogo.`,
        });
        setFeedbackMessage('Produto cadastrado com sucesso.');
      }

      playSuccess();
      resetForm();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(product) {
    setEditingProductId(product.id);
    setFormState(mapProductToForm(product));
    setFeedbackMessage('');
    setErrorMessage('');
  }

  async function handleDelete(productId) {
    const product = products.find((item) => item.id === productId);

    if (!currentStoreId || !window.confirm('Deseja excluir este produto?')) {
      return;
    }

    if (!can('catalog:write')) {
      setErrorMessage('Seu perfil nao pode alterar o catalogo.');
      playError();
      return;
    }

    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await deleteProduct({
        storeId: currentStoreId,
        productId,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'product.deleted',
        entityType: 'product',
        entityId: productId,
        description: `Produto ${product?.name ?? productId} excluido do catalogo.`,
      });

      if (editingProductId === productId) {
        resetForm();
      }

      setFeedbackMessage('Produto excluido com sucesso.');
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Produtos">
        <div className="entity-empty-state">
          <p className="text-section-title">Firebase nao configurado</p>
          <p className="text-body">Configure as variaveis VITE_FIREBASE_* para usar persistencia real.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Produtos">
        <div className="entity-empty-state">
          <p className="text-section-title">Nenhuma store ativa</p>
          <p className="text-body">Selecione ou vincule uma store antes de operar o catalogo.</p>
        </div>
      </SurfaceCard>
    );
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

      <SurfaceCard title={editingProductId ? 'Editar produto' : 'Cadastrar produto'}>
        <div className="entity-form-shell">
          <div className="entity-form-shell__header">
            <div className="entity-form-hero">
              <span className="entity-form-hero__eyebrow">Catalogo ativo</span>
              <h4 className="entity-form-hero__title">
                {editingProductId ? 'Atualize o produto em foco' : 'Cadastre itens com cara de cardapio profissional'}
              </h4>
              <p className="entity-form-hero__description">
                Organize preco, custo, estoque e classificacao em um fluxo mais claro para a operacao nao perder tempo no cadastro.
              </p>
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

          <form className="entity-form-grid" onSubmit={handleSubmit}>
            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Identidade</span>
                <h4 className="entity-form-section__title">Informacoes principais</h4>
                <p className="entity-form-section__description">Esses campos aparecem primeiro na busca e na rotina do caixa.</p>
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
                <p className="entity-form-section__description">Defina margem e controle de estoque no mesmo bloco.</p>
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
                <p className="entity-form-section__description">Detalhes para preparo, conferencia ou padrao interno da loja.</p>
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

      <SurfaceCard title="Base de produtos">
        <div className="entity-toolbar-shell">
          <div className="entity-toolbar-copy">
            <p className="text-section-title">Consulta refinada</p>
            <p className="text-body">Localize itens por nome, categoria, SKU ou recorte de status sem poluir a tela principal.</p>
          </div>

          <div className="entity-toolbar">
            <div className="ui-field">
              <label className="ui-label" htmlFor="products-search">Buscar</label>
              <input id="products-search" className="ui-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nome, categoria ou SKU" />
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
          </div>
        </div>

        {loading ? (
          <div className="entity-empty-state">
            <p className="text-section-title">Carregando produtos...</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="entity-empty-state">
            <p className="text-section-title">Nenhum produto encontrado</p>
            <p className="text-body">Cadastre itens ou ajuste os filtros para continuar.</p>
          </div>
        ) : (
          <div className="entity-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preco</th>
                  <th>Custo</th>
                  <th>Estoque</th>
                  <th>Minimo</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="ui-table__cell--strong">{product.name}</td>
                    <td>{product.category}</td>
                    <td className="ui-table__cell--numeric">{formatCurrency(product.price)}</td>
                    <td className="ui-table__cell--numeric">{formatCurrency(product.cost)}</td>
                    <td className="ui-table__cell--numeric">{product.stock}</td>
                    <td className="ui-table__cell--numeric">{product.minimumStock ?? 0}</td>
                    <td>{product.status === 'active' ? 'Ativo' : 'Inativo'}</td>
                    <td className="entity-table__actions">
                      <button type="button" className="ui-button ui-button--ghost" onClick={() => handleEdit(product)} disabled={!can('catalog:write')}>
                        Editar
                      </button>
                      <button type="button" className="ui-button ui-button--danger" onClick={() => handleDelete(product.id)} disabled={!can('catalog:write')}>
                        Excluir
                      </button>
                    </td>
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

export default ProductsModule;
