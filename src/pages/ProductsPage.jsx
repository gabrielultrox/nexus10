import PageIntro from '../components/common/PageIntro';
import ProductsModule from '../modules/products/components/ProductsModule';

function ProductsPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Catalogo"
        title="Produtos"
        description="Base real de produtos da store, pronta para alimentar o PDV com cadastro, estoque e preco."
      />

      <ProductsModule />
    </div>
  );
}

export default ProductsPage;
