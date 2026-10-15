import { ATTRIBUTE_GROUPS, getAttributeValue } from '../domain/attributes';
import type { PlayerAttributes } from '../domain/attributes';
import styles from './GameShell.module.css';

/** Only public attribute values enter this reusable component. */
export function AttributePanels({ attributes }: { attributes: PlayerAttributes }) {
  return <div className={styles.attributeGrid}>
    {ATTRIBUTE_GROUPS.map(group => <section key={group.id} className={`${styles.panel} ${styles.attributePanel}`} aria-labelledby={`attributes-${group.id}`}>
      <header className={styles.panelHead}><h2 id={`attributes-${group.id}`} className={styles.panelTitle}>{group.label}</h2><span className={styles.panelAside}>1–20</span></header>
      <div className={styles.attributeList}>{group.attributes.map(attribute => {
        const value = getAttributeValue(attributes, attribute.path);
        return <div className={`${styles.attribute} ${value === null ? styles.attributeUnknown : value >= 15 ? styles.attributeHigh : ''}`} key={attribute.path}>
          <span>{attribute.label}</span>
          <div className={styles.attributeBar} aria-hidden="true">{value !== null && <div className={styles.attributeFill} style={{ width: `${value * 5}%` }} />}</div>
          <span className={styles.attributeNumber} aria-label={value === null ? `${attribute.label}: unassessed` : `${attribute.label}: ${value} out of 20, original game estimate`}>{value ?? '—'}</span>
        </div>;
      })}</div>
    </section>)}
  </div>;
}
