import { useEffect, useRef, useState } from 'react';
import { ATTRIBUTE_GROUPS, getAttributeValue, type AttributePath, type Player, type PlayerAttributes } from './domain';
import styles from './AttributeEditor.module.css';

export interface EditorialInput {
  attributes: PlayerAttributes;
  method: string;
  confidence: 'low' | 'medium' | 'high';
}

export default function AttributeEditor({ player, onApply, onClose }: {
  player: Player;
  onApply: (input: EditorialInput) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    ATTRIBUTE_GROUPS.flatMap(group => group.attributes.map(attribute => [attribute.path, String(getAttributeValue(player.attributes, attribute.path) ?? '')])),
  ));
  const [method, setMethod] = useState('');
  const [confidence, setConfidence] = useState<EditorialInput['confidence']>('low');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  function changeValue(path: AttributePath, value: string) {
    setValues(current => ({ ...current, [path]: value }));
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={async event => {
      event.preventDefault();
      setError('');
      const attributes = structuredClone(player.attributes);
      for (const group of ATTRIBUTE_GROUPS) {
        for (const attribute of group.attributes) {
          const raw = values[attribute.path]?.trim() ?? '';
          const value = raw === '' ? null : Number(raw);
          if (value !== null && (!Number.isInteger(value) || value < 1 || value > 20)) {
            setError(`${attribute.label} must be a whole number from 1 to 20, or blank.`);
            return;
          }
          (attributes[group.id] as Record<string, number | null>)[attribute.key] = value;
        }
      }
      if (method.trim().length < 10) { setError('Describe the basis and uncertainty in at least 10 characters.'); return; }
      setSaving(true);
      try { await onApply({ attributes, method: method.trim(), confidence }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the assessment.'); }
      finally { setSaving(false); }
    }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>ORIGINAL GAME ASSESSMENT</span><h2 id="editor-title">Assess {player.name}</h2></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close attribute editor">Close</button>
      </header>
      <p className={styles.note}>These are your game-design estimates, separate from sourced biographical facts. Leave unsupported attributes blank. A role score appears only when its required attributes and positional familiarity are known. Hidden attributes stay outside this editor.</p>
      <div className={styles.fields}>{ATTRIBUTE_GROUPS.map(group => <fieldset key={group.id}>
        <legend>{group.label}</legend>
        {group.attributes.map(attribute => <label key={attribute.path}>
          <span>{attribute.label}</span>
          <input aria-label={attribute.label} type="number" min="1" max="20" step="1" placeholder="—" value={values[attribute.path] ?? ''} onChange={event => changeValue(attribute.path, event.target.value)} />
        </label>)}
      </fieldset>)}</div>
      <div className={styles.metadata}>
        <label>Basis and uncertainty<textarea required minLength={10} maxLength={1500} rows={2} value={method} placeholder="Explain your evidence, interpretation and any uncertainty. These are not verified player facts." onChange={event => setMethod(event.target.value)} /></label>
        <label>Confidence<select value={confidence} onChange={event => setConfidence(event.target.value as EditorialInput['confidence'])}><option value="low">Low — weak evidence</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <footer className={styles.footer}><span>A new database revision preserves the original reference.</span><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save assessment'}</button></footer>
    </form>
  </dialog>;
}
