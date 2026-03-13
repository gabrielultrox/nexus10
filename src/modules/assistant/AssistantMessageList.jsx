import { useEffect, useRef } from 'react';

const cardTypeLabelMap = {
  order: 'pedido',
  sale: 'venda',
  customer: 'cliente',
  product: 'produto',
};

function AssistantMessageList({ messages, onNavigate }) {
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  return (
    <div ref={listRef} className="assistant-messages">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`assistant-message assistant-message--${message.role}`}
        >
          {message.role === 'assistant' ? (
            <span className="assistant-message__badge">{message.title ?? 'NEXA'}</span>
          ) : null}

          <p className="assistant-message__content">{message.content}</p>

          {message.cards?.length > 0 ? (
            <div className="assistant-message__cards">
              {message.cards.map((card) => (
                <button
                  key={`${message.id}-${card.id}`}
                  type="button"
                  className="assistant-result-card"
                  onClick={() => card.route && onNavigate(card.route)}
                  disabled={!card.route}
                >
                  <span className="assistant-result-card__type">{cardTypeLabelMap[card.type] ?? 'resultado'}</span>
                  <strong>{card.title}</strong>
                  <small>{card.subtitle}</small>
                  <span>{card.meta}</span>
                </button>
              ))}
            </div>
          ) : null}

          {message.navigationTarget?.route ? (
            <button
              type="button"
              className="assistant-message__nav"
              onClick={() => onNavigate(message.navigationTarget.route)}
            >
              {message.navigationTarget.label ?? 'Abrir'}
            </button>
          ) : null}

          {message.suggestions?.length > 0 ? (
            <div className="assistant-message__suggestions">
              {message.suggestions.map((item) => (
                <span key={`${message.id}-${item}`} className="ui-badge ui-badge--special">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default AssistantMessageList;
