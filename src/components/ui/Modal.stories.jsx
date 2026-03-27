import { useState } from 'react';

import Button from './Button';
import Modal from './Modal';

function ModalStoryDemo(args) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir modal
      </Button>
      <Modal
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Confirmar
            </Button>
          </>
        }
      >
        <p className="story-copy">
          Este modal serve para formularios curtos, confirmacoes ricas e fluxos que precisam de contexto isolado.
        </p>
      </Modal>
    </>
  );
}

const meta = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Modal padrao do Nexus10 com botao de fechar, cabecalho documentado e area de rodape para acoes.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Titulo principal da janela.',
    },
    description: {
      control: 'text',
      description: 'Texto auxiliar abaixo do titulo.',
    },
    showCloseButton: {
      control: 'boolean',
      description: 'Exibe o botao de fechar no canto superior direito.',
    },
  },
};

export default meta;

export const Default = {
  render: (args) => <ModalStoryDemo {...args} />,
  args: {
    title: 'Editar pedido',
    description: 'Atualize os dados antes de salvar.',
    showCloseButton: true,
  },
};
