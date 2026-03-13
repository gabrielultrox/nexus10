import { createCustomer } from './customerService'
import { createProduct } from './productService'

const customerSeedTemplates = [
  {
    name: 'Joao Pedro',
    phone: '(37) 99991-0001',
    neighborhood: 'Centro',
    addressLine: 'Rua Principal, 120',
    reference: 'Ao lado da farmacia',
    notes: 'Cliente recorrente do balcao',
    status: 'active',
  },
  {
    name: 'Maria Clara',
    phone: '(37) 99991-0002',
    neighborhood: 'Sao Jose',
    addressLine: 'Av. Brasil, 44',
    reference: 'Portao branco',
    notes: 'Prefere contato por telefone',
    status: 'active',
  },
  {
    name: 'Rafael Nunes',
    phone: '(37) 99991-0003',
    neighborhood: 'Industrial',
    addressLine: 'Rua da Feira, 18',
    reference: 'Casa 2',
    notes: '',
    status: 'active',
  },
  {
    name: 'Patricia Lima',
    phone: '(37) 99991-0004',
    neighborhood: 'Nossa Senhora Aparecida',
    addressLine: 'Rua do Mercado, 87',
    reference: 'Sobrado azul',
    notes: 'Cliente de entrega',
    status: 'active',
  },
  {
    name: 'Carlos Henrique',
    phone: '(37) 99991-0005',
    neighborhood: 'Santa Tereza',
    addressLine: 'Rua 7 de Setembro, 302',
    reference: 'Em frente ao posto',
    notes: '',
    status: 'active',
  },
]

const productSeedTemplates = [
  {
    name: 'X-Burger Classico',
    category: 'Lanches',
    price: '24.90',
    cost: '10.40',
    stock: '40',
    minimumStock: '6',
    sku: 'LAN-001',
    status: 'active',
    description: 'Lanche base para testes operacionais do PDV.',
  },
  {
    name: 'X-Salada',
    category: 'Lanches',
    price: '27.90',
    cost: '11.80',
    stock: '36',
    minimumStock: '6',
    sku: 'LAN-002',
    status: 'active',
    description: 'Versao com alface e tomate.',
  },
  {
    name: 'Refrigerante Lata',
    category: 'Bebidas',
    price: '6.50',
    cost: '3.20',
    stock: '80',
    minimumStock: '12',
    sku: 'BEB-001',
    status: 'active',
    description: 'Bebida individual gelada.',
  },
  {
    name: 'Suco Natural 300ml',
    category: 'Bebidas',
    price: '8.90',
    cost: '4.10',
    stock: '25',
    minimumStock: '5',
    sku: 'BEB-002',
    status: 'active',
    description: 'Suco pronto para operacao do dia.',
  },
  {
    name: 'Batata Frita Media',
    category: 'Porcoes',
    price: '16.90',
    cost: '7.20',
    stock: '28',
    minimumStock: '4',
    sku: 'POR-001',
    status: 'active',
    description: 'Porcao complementar para pedidos e vendas diretas.',
  },
]

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

export async function seedBaseCustomers({
  storeId,
  tenantId,
  existingCustomers = [],
}) {
  const existingPhones = new Set(
    existingCustomers.map((customer) => normalizePhone(customer.phone ?? customer.phoneDisplay)),
  )
  const existingNames = new Set(
    existingCustomers.map((customer) => String(customer.name ?? '').trim().toLowerCase()),
  )

  let createdCount = 0

  for (const template of customerSeedTemplates) {
    const normalizedPhone = normalizePhone(template.phone)
    const normalizedName = template.name.trim().toLowerCase()

    if (existingPhones.has(normalizedPhone) || existingNames.has(normalizedName)) {
      continue
    }

    await createCustomer({
      storeId,
      tenantId,
      values: template,
    })

    existingPhones.add(normalizedPhone)
    existingNames.add(normalizedName)
    createdCount += 1
  }

  return {
    createdCount,
    totalTemplates: customerSeedTemplates.length,
  }
}

export async function seedBaseProducts({
  storeId,
  tenantId,
  existingProducts = [],
}) {
  const existingSkus = new Set(
    existingProducts.map((product) => String(product.sku ?? '').trim().toLowerCase()).filter(Boolean),
  )
  const existingNames = new Set(
    existingProducts.map((product) => String(product.name ?? '').trim().toLowerCase()),
  )

  let createdCount = 0

  for (const template of productSeedTemplates) {
    const normalizedSku = String(template.sku ?? '').trim().toLowerCase()
    const normalizedName = template.name.trim().toLowerCase()

    if (existingSkus.has(normalizedSku) || existingNames.has(normalizedName)) {
      continue
    }

    await createProduct({
      storeId,
      tenantId,
      values: template,
    })

    existingSkus.add(normalizedSku)
    existingNames.add(normalizedName)
    createdCount += 1
  }

  return {
    createdCount,
    totalTemplates: productSeedTemplates.length,
  }
}
