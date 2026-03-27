const bearerSecurity = [{ bearerAuth: [] }]

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Nexus10 Backend API',
    version: '1.0.0',
    description:
      'Documentacao OpenAPI do backend do Nexus10. Cobre autenticacao, pedidos, vendas, auditoria, assistente e integracoes iFood.',
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  tags: [
    { name: 'System', description: 'Rotas de saude e metadados da API.' },
    { name: 'Auth', description: 'Abertura de sessao autenticada para operadores locais.' },
    { name: 'Admin', description: 'Operacoes administrativas restritas.' },
    { name: 'Orders', description: 'Gestao de pedidos internos do Nexus10.' },
    { name: 'Sales', description: 'Gestao de vendas diretas e conversoes de pedido.' },
    { name: 'Assistant', description: 'Consulta assistida de dados operacionais.' },
    { name: 'iFood', description: 'Operacoes de integracao e sincronizacao com iFood.' },
    { name: 'Webhook', description: 'Endpoints de recepcao de webhooks externos.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID Token',
      },
    },
    parameters: {
      StoreId: {
        name: 'storeId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: 'store-demo-001',
      },
      OrderId: {
        name: 'orderId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: 'ord_20260327_001',
      },
      SaleId: {
        name: 'saleId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: 'sale_20260327_001',
      },
      MerchantId: {
        name: 'merchantId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: 'ifood-merchant-001',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: { error: { type: 'string', example: 'Nao foi possivel criar o pedido.' } },
        required: ['error'],
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Dados de entrada invalidos.' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          source: { type: 'string', example: 'body' },
          details: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
            example: { operator: ['operator e obrigatorio.'] },
          },
        },
        required: ['error', 'code', 'source', 'details'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'nexus-ifood-integration' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-03-27T15:02:12.000Z' },
        },
        required: ['status', 'service', 'timestamp'],
      },
      OperatorProfile: {
        type: 'object',
        properties: {
          uid: { type: 'string', example: 'local-gabriel' },
          operatorName: { type: 'string', example: 'Gabriel' },
          displayName: { type: 'string', example: 'Gabriel' },
          role: { type: 'string', example: 'admin' },
          tenantId: { type: 'string', example: 'tenant-demo' },
          defaultStoreId: { type: 'string', example: 'store-demo-001' },
          storeIds: { type: 'array', items: { type: 'string' }, example: ['store-demo-001'] },
        },
        required: [
          'uid',
          'operatorName',
          'displayName',
          'role',
          'tenantId',
          'defaultStoreId',
          'storeIds',
        ],
      },
      AuthSessionRequest: {
        type: 'object',
        properties: {
          pin: { type: 'string', example: '1234' },
          operator: { type: 'string', example: 'Gabriel' },
          storeId: { type: 'string', example: 'store-demo-001', nullable: true },
        },
        required: ['pin', 'operator'],
      },
      AuthSessionResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              customToken: { type: 'string', example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' },
              profile: { $ref: '#/components/schemas/OperatorProfile' },
            },
            required: ['customToken', 'profile'],
          },
        },
        required: ['data'],
      },
      OrderItemInput: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: 'prod_coca_2l' },
          quantity: { type: 'integer', example: 2 },
          unitPrice: { type: 'number', format: 'float', example: 12.5 },
          totalPrice: { type: 'number', format: 'float', example: 25.0 },
          productSnapshot: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'prod_coca_2l' },
              name: { type: 'string', example: 'Coca-Cola 2L' },
              category: { type: 'string', example: 'Bebidas' },
              sku: { type: 'string', example: 'COCA2L' },
            },
          },
        },
        required: ['productId', 'quantity', 'unitPrice'],
      },
      OrderTotals: {
        type: 'object',
        properties: {
          subtotal: { type: 'number', format: 'float', example: 25.0 },
          freight: { type: 'number', format: 'float', example: 4.0 },
          extraAmount: { type: 'number', format: 'float', example: 0 },
          discountPercent: { type: 'number', format: 'float', example: 0 },
          discountValue: { type: 'number', format: 'float', example: 0 },
          total: { type: 'number', format: 'float', example: 29.0 },
        },
      },
      OrderPayload: {
        type: 'object',
        properties: {
          source: { type: 'string', example: 'BALCAO' },
          customerId: { type: 'string', example: 'customer-001', nullable: true },
          customerSnapshot: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'customer-001' },
              name: { type: 'string', example: 'Cliente avulso' },
              phone: { type: 'string', example: '11999990000' },
              neighborhood: { type: 'string', example: 'Centro' },
            },
          },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItemInput' } },
          totals: { $ref: '#/components/schemas/OrderTotals' },
          paymentMethod: { type: 'string', example: 'PIX' },
          paymentPreview: {
            type: 'object',
            properties: {
              method: { type: 'string', example: 'PIX' },
              label: { type: 'string', example: 'Pix' },
              amount: { type: 'number', format: 'float', example: 29.0 },
            },
          },
          address: {
            type: 'object',
            properties: {
              neighborhood: { type: 'string', example: 'Centro' },
              addressLine: { type: 'string', example: 'Rua A, 123' },
              reference: { type: 'string', example: 'Em frente a farmacia' },
              complement: { type: 'string', example: 'Apto 12' },
            },
          },
          notes: { type: 'string', example: 'Sem cebola' },
        },
        required: ['source', 'items', 'totals'],
      },
      OrderMutationRequest: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', example: 'tenant-demo', nullable: true },
          values: { $ref: '#/components/schemas/OrderPayload' },
        },
        required: ['values'],
      },
      OrderResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: { id: { type: 'string', example: 'ord_20260327_001' } },
            additionalProperties: true,
          },
        },
        required: ['data'],
      },
      SalePayload: {
        type: 'object',
        properties: {
          channel: { type: 'string', example: 'BALCAO' },
          customerId: { type: 'string', nullable: true, example: 'customer-001' },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItemInput' } },
          totals: { $ref: '#/components/schemas/OrderTotals' },
          paymentMethod: { type: 'string', enum: ['CASH', 'CARD', 'PIX'], example: 'PIX' },
          payment: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: ['CASH', 'CARD', 'PIX'], example: 'PIX' },
            },
          },
          notes: { type: 'string', example: 'Venda direta do balcao' },
        },
        required: ['items'],
      },
      SaleMutationRequest: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', example: 'tenant-demo', nullable: true },
          values: { $ref: '#/components/schemas/SalePayload' },
        },
        required: ['values'],
      },
      SaleStatusRequest: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['POSTED', 'CANCELLED', 'REVERSED'],
            example: 'REVERSED',
          },
        },
        required: ['status'],
      },
      SaleResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: { id: { type: 'string', example: 'sale_20260327_001' } },
            additionalProperties: true,
          },
        },
        required: ['data'],
      },
      AuditLogEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'audit_001' },
          storeId: { type: 'string', example: 'store-demo-001' },
          actorId: { type: 'string', example: 'local-gabriel' },
          actorName: { type: 'string', example: 'Gabriel' },
          actorRole: { type: 'string', example: 'admin' },
          action: { type: 'string', example: 'order.created' },
          resource: { type: 'string', example: 'order' },
          resourceId: { type: 'string', example: 'ord_20260327_001' },
          description: { type: 'string', example: 'Novo pedido BALCAO criado com total R$ 29,00.' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-03-27T15:02:12.000Z' },
          metadata: { type: 'object', nullable: true, additionalProperties: true },
        },
      },
      AuditLogListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/AuditLogEntry' } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer', example: 1 },
                  limit: { type: 'integer', example: 50 },
                  total: { type: 'integer', example: 128 },
                  pages: { type: 'integer', example: 3 },
                },
              },
              filters: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      IfoodMerchantListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                merchantId: { type: 'string', example: 'ifood-merchant-001' },
                name: { type: 'string', example: 'Loja Centro' },
                source: { type: 'string', example: 'ifood' },
                tenantId: { type: 'string', example: 'tenant-demo' },
                lastSyncAt: { type: 'string', format: 'date-time', nullable: true },
              },
              additionalProperties: true,
            },
          },
        },
      },
      IfoodPollingRequest: {
        type: 'object',
        properties: {
          storeId: { type: 'string', example: 'store-demo-001' },
          merchantId: { type: 'string', example: 'ifood-merchant-001' },
        },
        required: ['storeId', 'merchantId'],
      },
      IfoodWebhookTextBody: {
        type: 'string',
        example:
          '{"id":"evt-001","code":"PLACED","fullCode":"PLC","orderId":"ifood-order-001","createdAt":"2026-03-27T15:00:00.000Z"}',
      },
      IfoodProcessResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: true,
            example: { processed: 4, events: [{ eventId: 'evt-001', orderId: 'ifood-order-001' }] },
          },
        },
        required: ['ok'],
      },
      AssistantQueryRequest: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Qual foi o faturamento do dia?' },
          context: {
            type: 'object',
            additionalProperties: true,
            example: { scope: 'today', module: 'sales' },
          },
        },
        required: ['message'],
      },
      AssistantQueryResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            additionalProperties: true,
            example: {
              summary: 'O faturamento do dia foi R$ 3.250,00.',
              sources: ['sales', 'financialClosures'],
            },
          },
        },
      },
    },
  },
  paths: {},
}

swaggerSpec.paths['/api/health'] = {
  get: {
    tags: ['System'],
    summary: 'Health check da API',
    responses: {
      200: {
        description: 'API operacional',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } },
        },
      },
    },
  },
}

swaggerSpec.paths['/api/auth/session'] = {
  post: {
    tags: ['Auth'],
    summary: 'Abre sessao autenticada para operador local',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AuthSessionRequest' },
          examples: {
            default: { value: { pin: '1234', operator: 'Gabriel', storeId: 'store-demo-001' } },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Sessao criada',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } },
        },
      },
      400: {
        description: 'Payload invalido',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } },
        },
      },
      401: {
        description: 'PIN incorreto',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      503: {
        description: 'Senha operacional ausente',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/admin/audit-logs'] = {
  get: {
    tags: ['Admin'],
    security: bearerSecurity,
    summary: 'Lista logs de auditoria com filtros e paginacao',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, example: 1 },
      {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', default: 50, maximum: 200 },
        example: 50,
      },
      { name: 'actor', in: 'query', schema: { type: 'string' }, example: 'Gabriel' },
      { name: 'action', in: 'query', schema: { type: 'string' }, example: 'order.created' },
      { name: 'resource', in: 'query', schema: { type: 'string' }, example: 'order' },
      {
        name: 'date',
        in: 'query',
        schema: { type: 'string', format: 'date' },
        example: '2026-03-27',
      },
    ],
    responses: {
      200: {
        description: 'Pagina de logs',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/AuditLogListResponse' } },
        },
      },
      403: {
        description: 'Acesso restrito a admin',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/orders'] = {
  post: {
    tags: ['Orders'],
    security: bearerSecurity,
    summary: 'Cria um pedido interno',
    parameters: [{ $ref: '#/components/parameters/StoreId' }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/OrderMutationRequest' },
          examples: {
            default: {
              value: {
                tenantId: 'tenant-demo',
                values: {
                  source: 'BALCAO',
                  customerId: 'customer-001',
                  items: [
                    { productId: 'prod_coca_2l', quantity: 2, unitPrice: 12.5, totalPrice: 25 },
                  ],
                  totals: {
                    subtotal: 25,
                    freight: 4,
                    extraAmount: 0,
                    discountPercent: 0,
                    discountValue: 0,
                    total: 29,
                  },
                  paymentMethod: 'PIX',
                  notes: 'Sem cebola',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Pedido criado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderResponse' } } },
      },
      400: {
        description: 'Payload invalido',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } },
        },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/orders/{orderId}'] = {
  patch: {
    tags: ['Orders'],
    security: bearerSecurity,
    summary: 'Atualiza um pedido',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/OrderId' },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/OrderMutationRequest' } },
      },
    },
    responses: {
      200: {
        description: 'Pedido atualizado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderResponse' } } },
      },
    },
  },
  delete: {
    tags: ['Orders'],
    security: bearerSecurity,
    summary: 'Exclui um pedido',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/OrderId' },
    ],
    responses: {
      200: {
        description: 'Pedido excluido',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/orders/{orderId}/dispatch'] = {
  post: {
    tags: ['Orders'],
    security: bearerSecurity,
    summary: 'Marca um pedido como despachado',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/OrderId' },
    ],
    responses: {
      200: {
        description: 'Pedido despachado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/orders/{orderId}/convert-to-sale'] = {
  post: {
    tags: ['Orders', 'Sales'],
    security: bearerSecurity,
    summary: 'Converte pedido em venda',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/OrderId' },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/OrderMutationRequest' } },
      },
    },
    responses: {
      200: {
        description: 'Venda gerada a partir do pedido',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SaleResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/sales'] = {
  post: {
    tags: ['Sales'],
    security: bearerSecurity,
    summary: 'Cria uma venda direta',
    parameters: [{ $ref: '#/components/parameters/StoreId' }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SaleMutationRequest' },
          examples: {
            default: {
              value: {
                tenantId: 'tenant-demo',
                values: {
                  channel: 'BALCAO',
                  customerId: 'customer-001',
                  items: [{ productId: 'prod_coca_2l', quantity: 1, unitPrice: 12.5 }],
                  totals: {
                    subtotal: 12.5,
                    freight: 0,
                    extraAmount: 0,
                    discountPercent: 0,
                    discountValue: 0,
                    total: 12.5,
                  },
                  paymentMethod: 'PIX',
                  payment: { method: 'PIX' },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Venda criada',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SaleResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/orders/{orderId}/sales'] = {
  post: {
    tags: ['Sales'],
    security: bearerSecurity,
    summary: 'Cria venda a partir de um pedido',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/OrderId' },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/SaleMutationRequest' } },
      },
    },
    responses: {
      201: {
        description: 'Venda criada a partir do pedido',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SaleResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/sales/{saleId}/status'] = {
  patch: {
    tags: ['Sales'],
    security: bearerSecurity,
    summary: 'Atualiza o status de uma venda',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/SaleId' },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SaleStatusRequest' },
          examples: { reverse: { value: { status: 'REVERSED' } } },
        },
      },
    },
    responses: {
      200: {
        description: 'Status atualizado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SaleResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/sales/{saleId}'] = {
  delete: {
    tags: ['Sales'],
    security: bearerSecurity,
    summary: 'Exclui uma venda',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/SaleId' },
    ],
    responses: {
      200: {
        description: 'Venda excluida',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SaleResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/stores/{storeId}/assistant/query'] = {
  post: {
    tags: ['Assistant'],
    security: bearerSecurity,
    summary: 'Executa consulta assistida da NEXA',
    parameters: [{ $ref: '#/components/parameters/StoreId' }],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/AssistantQueryRequest' } },
      },
    },
    responses: {
      200: {
        description: 'Consulta processada',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/AssistantQueryResponse' } },
        },
      },
    },
  },
}

swaggerSpec.paths['/api/integrations/ifood/merchants/{storeId}'] = {
  get: {
    tags: ['iFood'],
    security: bearerSecurity,
    summary: 'Lista merchants iFood da loja',
    parameters: [{ $ref: '#/components/parameters/StoreId' }],
    responses: {
      200: {
        description: 'Merchants encontrados',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/IfoodMerchantListResponse' },
          },
        },
      },
    },
  },
}

swaggerSpec.paths['/api/integrations/ifood/polling/run'] = {
  post: {
    tags: ['iFood'],
    security: bearerSecurity,
    summary: 'Executa polling manual do iFood',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/IfoodPollingRequest' },
          examples: {
            default: { value: { storeId: 'store-demo-001', merchantId: 'ifood-merchant-001' } },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Polling processado',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/IfoodProcessResponse' } },
        },
      },
      404: {
        description: 'Merchant nao encontrado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
}

swaggerSpec.paths['/api/integrations/ifood/orders/{storeId}/{merchantId}/{orderId}/sync'] = {
  post: {
    tags: ['iFood'],
    security: bearerSecurity,
    summary: 'Sincroniza um pedido especifico do iFood',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/MerchantId' },
      { $ref: '#/components/parameters/OrderId' },
    ],
    responses: {
      200: {
        description: 'Pedido sincronizado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/IfoodProcessResponse' },
            examples: {
              default: {
                value: {
                  ok: true,
                  data: {
                    id: 'ifood-order-001',
                    status: 'PLACED',
                    merchantId: 'ifood-merchant-001',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

swaggerSpec.paths['/webhooks/ifood/{storeId}/{merchantId}'] = {
  post: {
    tags: ['Webhook', 'iFood'],
    summary: 'Recebe webhook do iFood',
    parameters: [
      { $ref: '#/components/parameters/StoreId' },
      { $ref: '#/components/parameters/MerchantId' },
      {
        name: 'X-IFood-Signature',
        in: 'header',
        required: true,
        schema: { type: 'string' },
        example: 'sha256=14b8b8b9af5f1c3...',
      },
    ],
    requestBody: {
      required: true,
      content: {
        'text/plain': { schema: { $ref: '#/components/schemas/IfoodWebhookTextBody' } },
        'application/json': { schema: { $ref: '#/components/schemas/IfoodWebhookTextBody' } },
      },
    },
    responses: {
      200: {
        description: 'Webhook processado',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/IfoodProcessResponse' } },
        },
      },
      401: {
        description: 'Assinatura invalida ou falha de processamento',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
}

export const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'Nexus10 API Docs',
}
