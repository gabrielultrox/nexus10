const IFOOD_WIDGET_SCRIPT_URL = 'https://widgets.ifood.com.br/widget.js';

let widgetScriptPromise = null;

export function loadIfoodWidgetScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.iFoodWidget) {
    return Promise.resolve(window.iFoodWidget);
  }

  if (widgetScriptPromise) {
    return widgetScriptPromise;
  }

  widgetScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${IFOOD_WIDGET_SCRIPT_URL}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.iFoodWidget ?? null), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Nao foi possivel carregar o widget do iFood.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = IFOOD_WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.iFoodWidget ?? null);
    script.onerror = () => reject(new Error('Nao foi possivel carregar o widget do iFood.'));
    document.head.appendChild(script);
  });

  return widgetScriptPromise;
}

export function getIfoodWidgetScriptUrl() {
  return IFOOD_WIDGET_SCRIPT_URL;
}
