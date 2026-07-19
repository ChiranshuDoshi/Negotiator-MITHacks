import {
  ArrowDownRight,
  CheckCircle,
  LockKey,
  PhoneCall,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Waveform } from "./Waveform.jsx";

const concessions = [
  { time: "00:42", label: "Loyalty credit", price: "$1,546" },
  { time: "01:18", label: "Bundle match", price: "$1,472" },
  { time: "02:06", label: "Final approval", price: "$1,428" },
];

function OutcomeMetrics({ compact = false }) {
  return (
    <div className={compact ? "command-metrics command-metrics--compact" : "command-metrics"}>
      <div className="command-metric command-metric--muted">
        <span>Original quote</span>
        <strong>$1,684</strong>
      </div>
      <div className="command-final-price">
        <span>Negotiated annual premium</span>
        <strong>$1,428</strong>
        <small>$119 / month</small>
      </div>
      <div className="command-metric command-metric--target">
        <span>Private target</span>
        <strong>$1,450</strong>
        <small><CheckCircle size={13} weight="fill" /> Achieved</small>
      </div>
    </div>
  );
}

export function CarCommandCenter({ style }) {
  return (
    <div className="car-command-center" style={style} aria-hidden="true">
      <header className="car-command-head">
        <div>
          <span className="car-command-mark">PS</span>
          <strong>PolicyScout</strong>
        </div>
        <span className="car-command-live"><i /> Negotiation complete</span>
        <LockKey size={14} weight="fill" />
      </header>

      <OutcomeMetrics compact />

      <div className="car-command-lower">
        <div className="car-command-audio">
          <div>
            <PhoneCall size={14} weight="fill" />
            <span>AutoSource · 02:31</span>
          </div>
          <Waveform compact progress={0.82} label="Completed negotiation waveform" />
        </div>
        <div className="car-command-proof">
          <span><ShieldCheck size={14} weight="fill" /> Coverage unchanged</span>
          <span><ArrowDownRight size={14} weight="bold" /> $256 saved · 15.2%</span>
        </div>
      </div>
    </div>
  );
}

export function FullCommandCenter({ contentOpacity = 1, style }) {
  return (
    <div className="full-command-center" style={{ ...style, opacity: contentOpacity }} aria-hidden="true">
      <header className="full-command-topbar">
        <div className="full-command-brand">
          <span className="brand-mark">PS</span>
          <div><strong>PolicyScout</strong><small>Auto insurance</small></div>
        </div>
        <div className="full-command-path"><span>Quotes</span><i /> <strong>Negotiation result</strong></div>
        <div className="full-command-verified"><SealCheck size={17} weight="fill" /> Verified evidence</div>
      </header>

      <main className="full-command-main">
        <div className="full-command-title">
          <div>
            <span className="scene-index">Negotiation complete</span>
            <h2>Your target was reached.</h2>
            <p>AutoSource approved a lower premium with the selected coverage unchanged.</p>
          </div>
          <div className="full-command-status"><CheckCircle size={18} weight="fill" /> Target achieved</div>
        </div>

        <section className="full-command-outcome">
          <OutcomeMetrics />
          <div className="full-command-savings">
            <span>Total annual savings</span>
            <strong>$256</strong>
            <small>15.2% below the original quote</small>
          </div>
        </section>

        <section className="full-command-evidence">
          <div className="full-command-call">
            <header>
              <div><PhoneCall size={17} weight="fill" /><span>Negotiation call · AutoSource</span></div>
              <strong>02:31</strong>
            </header>
            <Waveform active progress={0.82} label="Negotiation call waveform" />
            <footer><LockKey size={14} weight="fill" /> Recording and transcript verified</footer>
          </div>

          <div className="full-command-timeline">
            <header><span>Verified concessions</span><strong>3 price improvements</strong></header>
            {concessions.map((item, index) => (
              <div className="full-command-concession" key={item.time}>
                <span className="concession-index">0{index + 1}</span>
                <time>{item.time}</time>
                <span>{item.label}</span>
                <strong>{item.price}</strong>
              </div>
            ))}
            <footer><ShieldCheck size={15} weight="fill" /> Liability, collision, comprehensive, and roadside limits unchanged.</footer>
          </div>
        </section>
      </main>
    </div>
  );
}
