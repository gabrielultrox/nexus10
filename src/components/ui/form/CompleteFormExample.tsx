import { useState } from 'react'

import Button from '../Button'
import Card from '../Card'
import FormRow from '../FormRow'

import Checkbox, { CheckboxGroup } from './Checkbox'
import DatePicker from './DatePicker'
import FileInput from './FileInput'
import FormField from './FormField'
import Input from './Input'
import { RadioGroup } from './Radio'
import Select from './Select'
import Textarea from './Textarea'
import type { ICompleteFormExampleValues } from './types'

const CATEGORY_OPTIONS = [
  { label: 'Troco pendente', value: 'change' },
  { label: 'Estorno', value: 'refund' },
  { label: 'Cobranca incorreta', value: 'charge' },
]

const PRIORITY_OPTIONS = [
  { label: 'Baixa', value: 'low' },
  { label: 'Media', value: 'medium' },
  { label: 'Alta', value: 'high' },
]

const TAG_OPTIONS = [
  { label: 'Cliente contatado', value: 'contacted' },
  { label: 'Precisa validacao financeira', value: 'finance' },
  { label: 'Relacionada a entregador', value: 'courier' },
]

function CompleteFormExample() {
  const [values, setValues] = useState<ICompleteFormExampleValues>({
    fullName: '',
    email: '',
    phone: '',
    category: '',
    urgency: 'medium',
    tags: [],
    description: '',
    dueDate: '',
    resolutionWindow: {},
    attachments: [],
  })

  return (
    <Card>
      <Card.Header>
        <div>
          <h3>Formulario operacional</h3>
          <p>Exemplo completo usando a suite reutilizavel de form components.</p>
        </div>
      </Card.Header>
      <Card.Body>
        <FormRow>
          <FormField label="Nome do cliente" required htmlFor="example-full-name">
            <Input
              id="example-full-name"
              placeholder="Digite o nome"
              value={values.fullName}
              onChange={(event) =>
                setValues((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Telefone" required htmlFor="example-phone">
            <Input
              id="example-phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={values.phone}
              onChange={(event) =>
                setValues((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label="Email" htmlFor="example-email">
            <Input
              id="example-email"
              type="email"
              placeholder="cliente@email.com"
              value={values.email}
              onChange={(event) =>
                setValues((current) => ({ ...current, email: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Categoria" required>
            <Select
              placeholder="Selecione a categoria"
              options={CATEGORY_OPTIONS}
              value={values.category}
              onValueChange={(category) => setValues((current) => ({ ...current, category }))}
            />
          </FormField>
        </FormRow>

        <FormField label="Prioridade">
          <RadioGroup
            name="example-urgency"
            value={values.urgency}
            options={PRIORITY_OPTIONS}
            onChange={(urgency) => setValues((current) => ({ ...current, urgency }))}
          />
        </FormField>

        <FormField
          label="Tags de acompanhamento"
          hint="Use o group variant para checklists ou flags."
        >
          <CheckboxGroup
            name="example-tags"
            value={values.tags}
            options={TAG_OPTIONS}
            onChange={(tags) => setValues((current) => ({ ...current, tags }))}
          />
        </FormField>

        <FormField label="Descricao" hint="O contador ajuda a limitar a observacao operacional.">
          <Textarea
            placeholder="Descreva o problema e os proximos passos"
            maxLength={280}
            showCounter
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
          />
        </FormField>

        <FormRow>
          <FormField label="Prazo alvo">
            <DatePicker
              value={values.dueDate}
              onChange={(dueDate) =>
                setValues((current) => ({ ...current, dueDate: String(dueDate || '') }))
              }
            />
          </FormField>
          <FormField label="Janela de resolucao">
            <DatePicker
              range
              value={values.resolutionWindow}
              onChange={(resolutionWindow) =>
                setValues((current) => ({
                  ...current,
                  resolutionWindow:
                    typeof resolutionWindow === 'string'
                      ? { start: resolutionWindow }
                      : resolutionWindow,
                }))
              }
            />
          </FormField>
        </FormRow>

        <FormField label="Anexos">
          <FileInput
            value={values.attachments}
            onChange={(attachments) => setValues((current) => ({ ...current, attachments }))}
          />
        </FormField>

        <FormField label="Checklist rapido" inline>
          <Checkbox
            label="Pendencia sensivel para o financeiro"
            checked={values.tags.includes('finance')}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                tags: event.target.checked
                  ? [...new Set([...current.tags, 'finance'])]
                  : current.tags.filter((item) => item !== 'finance'),
              }))
            }
          />
        </FormField>
      </Card.Body>
      <Card.Footer>
        <Button variant="ghost" type="button">
          Cancelar
        </Button>
        <Button variant="primary" type="button">
          Salvar formulario
        </Button>
      </Card.Footer>
    </Card>
  )
}

export default CompleteFormExample
