import { useState } from 'react';

function AssistantInput({ disabled, onSend }) {
  const [value, setValue] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    const nextValue = value.trim();

    if (!nextValue) {
      return;
    }

    onSend(nextValue);
    setValue('');
  }

  return (
    <form className="assistant-input" onSubmit={handleSubmit}>
      <input
        className="assistant-input__field"
        value={value}
        placeholder="Pergunte à NEXA"
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
      />
      <button type="submit" className="ui-button ui-button--primary" disabled={disabled}>
        Enviar
      </button>
    </form>
  );
}

export default AssistantInput;
