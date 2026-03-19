import { useEffect, useMemo, useRef, useState } from 'react';

const BOOT_SEQUENCE = [
  { id: 'boot-1', label: 'INICIALIZANDO NEXUS', accent: 'danger' },
  { id: 'boot-2', label: 'CARREGANDO MODULOS OPERACIONAIS', accent: 'info' },
  { id: 'boot-3', label: 'SERVICO DE ACESSO PRONTO', accent: 'success' },
  { id: 'boot-4', label: 'PAINEL PRINCIPAL LIBERADO', accent: 'special' },
];

const SUBSYSTEMS = [
  { id: 'sub-1', label: 'Entregas', value: 'Sincronizado', tone: 'success' },
  { id: 'sub-2', label: 'Financeiro', value: 'Ao vivo', tone: 'info' },
  { id: 'sub-3', label: 'Estabilidade', value: 'Alta', tone: 'special' },
  { id: 'sub-4', label: 'Acesso', value: 'Protegido', tone: 'danger' },
];

const PARTICLE_COUNT = 18;
const BOOT_DURATION_MS = 3200;
const FADE_DURATION_MS = 520;

function createParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    id: `particle-${index}`,
    size: 2 + (index % 4),
    left: `${4 + ((index * 13) % 88)}%`,
    top: `${8 + ((index * 17) % 76)}%`,
    delay: `${(index % 6) * 0.42}s`,
    duration: `${5.8 + (index % 5) * 0.7}s`,
  }));
}

function getCoreLabel(progress) {
  if (progress < 28) {
    return 'Inicializacao';
  }

  if (progress < 56) {
    return 'Sincronizacao';
  }

  if (progress < 82) {
    return 'Validacao';
  }

  return 'Liberacao final';
}

function SystemBoot({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [visibleLineCount, setVisibleLineCount] = useState(1);
  const [isClosing, setIsClosing] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const particles = useMemo(createParticles, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let progressValue = 0;
    let closed = false;

    const progressInterval = window.setInterval(() => {
      progressValue += progressValue < 68 ? 4 : progressValue < 92 ? 2 : 1;
      const nextValue = progressValue > 100 ? 100 : progressValue;

      setProgress(nextValue);
      setVisibleLineCount(Math.min(BOOT_SEQUENCE.length, Math.max(1, Math.ceil((nextValue / 100) * BOOT_SEQUENCE.length))));

      if (nextValue >= 100) {
        window.clearInterval(progressInterval);
        setIsClosing(true);
        window.setTimeout(() => {
          if (!closed) {
            onCompleteRef.current?.();
          }
        }, FADE_DURATION_MS);
      }
    }, BOOT_DURATION_MS / 40);

    return () => {
      closed = true;
      window.clearInterval(progressInterval);
    };
  }, []);

  const visibleLines = BOOT_SEQUENCE.slice(0, visibleLineCount);
  const coreLabel = getCoreLabel(progress);

  return (
    <div className={`system-boot${isClosing ? ' system-boot--closing' : ''}`} aria-live="polite">
      <div className="system-boot__backdrop">
        <div className="system-boot__grid" />
        <div className="system-boot__scanline" />
        <div className="system-boot__noise" />
        <div className="system-boot__glitch-band" />
        <div className="system-boot__horizon" />
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="system-boot__particle"
            style={{
              '--boot-particle-size': `${particle.size}px`,
              '--boot-particle-left': particle.left,
              '--boot-particle-top': particle.top,
              '--boot-particle-delay': particle.delay,
              '--boot-particle-duration': particle.duration,
            }}
          />
        ))}
      </div>

      <div className="system-boot__shell">
        <header className="system-boot__header">
          <div className="system-boot__brand">
            <img src="/brand-bolt-red.svg" alt="" className="system-boot__brand-mark" />
            <div>
              <strong>NEXUS</strong>
              <span>ERP operacional em tempo real</span>
            </div>
          </div>

          <div className="system-boot__header-rail">
            <span className="system-boot__status-chip">SEQUENCIA DE INICIALIZACAO</span>
            <span className="system-boot__status-chip system-boot__status-chip--dim">ETAPA {coreLabel.toUpperCase()}</span>
          </div>
        </header>

        <div className="system-boot__subsystems">
          {SUBSYSTEMS.map((system) => (
            <div key={system.id} className={`system-boot__subsystem system-boot__subsystem--${system.tone}`}>
              <span>{system.label}</span>
              <strong>{system.value}</strong>
            </div>
          ))}
        </div>

        <div className="system-boot__content">
          <aside className="system-boot__telemetry">
            <div className="system-boot__telemetry-card">
              <span>Sinal</span>
              <strong>Estavel</strong>
            </div>
            <div className="system-boot__telemetry-card">
              <span>Latencia</span>
              <strong>12ms</strong>
            </div>
            <div className="system-boot__telemetry-card">
              <span>Nucleo</span>
              <strong>Sincronizado</strong>
            </div>
          </aside>

          <section className="system-boot__core">
            <div className="system-boot__copy">
              <div className="system-boot__copy-mark">
                <img src="/brand-bolt-red.svg" alt="" className="system-boot__copy-mark-icon" />
                <span className="system-boot__copy-mark-line" />
              </div>
              <p className="system-boot__eyebrow">Inicializacao do sistema</p>
              <h1 className="system-boot__title">Preparando o ambiente operacional</h1>
              <p className="system-boot__description">
                Carregando interface, acesso local e modulos principais antes de liberar o painel da operacao.
              </p>
            </div>

            <div className="system-boot__metrics">
              <div>
                <span>Etapa atual</span>
                <strong>{coreLabel}</strong>
              </div>
              <div>
                <span>Sincronizacao</span>
                <strong>{progress < 100 ? 'Em andamento' : 'Concluida'}</strong>
              </div>
              <div>
                <span>Interface</span>
                <strong>Pronta</strong>
              </div>
            </div>
          </section>

          <section className="system-boot__console">
            <div className="system-boot__console-head">
              <span>Log da inicializacao</span>
              <span>{progress}% concluido</span>
            </div>
            <div className="system-boot__console-body">
              {visibleLines.map((line, index) => (
                <p
                  key={line.id}
                  className={`system-boot__line system-boot__line--${line.accent}`}
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  {line.label}
                </p>
              ))}
            </div>
          </section>
        </div>

        <footer className="system-boot__footer">
          <div className="system-boot__progress-track">
            <span className="system-boot__progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="system-boot__footer-meta">
            <span>Integridade da sequencia 100%</span>
            <span>Preparando entrada no ERP</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SystemBoot;
