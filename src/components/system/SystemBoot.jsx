import { useEffect, useMemo, useRef, useState } from 'react';

const BOOT_SEQUENCE = [
  { id: 'boot-1', label: 'INITIALIZING NEXUS SYSTEM', accent: 'danger' },
  { id: 'boot-2', label: 'LOADING OPERATIONAL MODULES', accent: 'info' },
  { id: 'boot-3', label: 'AUTH SERVICE READY', accent: 'success' },
  { id: 'boot-4', label: 'DASHBOARD ENGINE STARTED', accent: 'special' },
];

const SUBSYSTEMS = [
  { id: 'sub-1', label: 'Dispatch mesh', value: 'Synced', tone: 'success' },
  { id: 'sub-2', label: 'Finance bus', value: 'Live', tone: 'info' },
  { id: 'sub-3', label: 'Threat floor', value: 'Low', tone: 'special' },
  { id: 'sub-4', label: 'Access lane', value: 'Armed', tone: 'danger' },
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
    return 'Boot lattice';
  }

  if (progress < 56) {
    return 'Signal mesh';
  }

  if (progress < 82) {
    return 'Runtime gate';
  }

  return 'App handoff';
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
              <strong>Nexus-10 OS</strong>
              <span>Industrial cybernetic runtime</span>
            </div>
          </div>

          <div className="system-boot__header-rail">
            <span className="system-boot__status-chip">BOOT SEQUENCE / LIVE</span>
            <span className="system-boot__status-chip system-boot__status-chip--dim">CORE {coreLabel.toUpperCase()}</span>
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
              <span>Signal</span>
              <strong>Stable</strong>
            </div>
            <div className="system-boot__telemetry-card">
              <span>Latency</span>
              <strong>12ms</strong>
            </div>
            <div className="system-boot__telemetry-card">
              <span>Core mesh</span>
              <strong>Synced</strong>
            </div>
          </aside>

          <section className="system-boot__core">
            <div className="system-boot__copy">
              <div className="system-boot__copy-mark">
                <img src="/brand-bolt-red.svg" alt="" className="system-boot__copy-mark-icon" />
                <span className="system-boot__copy-mark-line" />
              </div>
              <p className="system-boot__eyebrow">System startup</p>
              <h1 className="system-boot__title">Booting nexus operational shell</h1>
              <p className="system-boot__description">
                Carregando malha visual, autenticacao local e estrutura operacional antes do dashboard assumir a sessao.
              </p>
            </div>

            <div className="system-boot__metrics">
              <div>
                <span>Runtime stage</span>
                <strong>{coreLabel}</strong>
              </div>
              <div>
                <span>Frame sync</span>
                <strong>{progress < 100 ? 'Tracking' : 'Locked'}</strong>
              </div>
              <div>
                <span>Visual bridge</span>
                <strong>Primed</strong>
              </div>
            </div>
          </section>

          <section className="system-boot__console">
            <div className="system-boot__console-head">
              <span>Runtime log</span>
              <span>{progress}% complete</span>
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
            <span>Sequence integrity 100%</span>
            <span>Preparing transition to app shell</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SystemBoot;
