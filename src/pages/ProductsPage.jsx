import PageIntro from '../components/common/PageIntro'
import ProductsModule from '../modules/products/components/ProductsModule'

function ProductsPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Catalogo"
        title="Produtos"
        description="Cadastre produtos, organize categorias e acompanhe preco e estoque com uma leitura mais simples."
      />

      <ProductsModule />
    </div>
  )
}

export default ProductsPage
