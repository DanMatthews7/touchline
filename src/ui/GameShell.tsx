import { useRef, useState } from 'react';
import type { Club, DatabaseSnapshot, GameState } from '../domain/models';
import { visiblePlayer } from '../domain/models';
import { assessedCount, initials, readableDate } from './formatters';
import { Icon, type IconName } from './Icon';
import { PlayerProfile } from './PlayerProfile';
import { SquadTable } from './SquadTable';
import './tokens.css';
import styles from './GameShell.module.css';

export type AppNotice = { kind: 'success' | 'error' | 'info'; text: string };
export interface GameShellProps {
  snapshot: DatabaseSnapshot;
  career: GameState | null;
  storageStatus: string;
  appNotice?: AppNotice | null;
  onSelectClub: (clubId: string) => void | Promise<void>;
  onImportDatabase: (file: File) => void | Promise<void>;
  onImportSave: (file: File) => void | Promise<void>;
  onExportSave: () => void | Promise<void>;
  onNewCareer: () => void | Promise<void>;
  onSelectPlayer?: (playerId: string) => void;
  onEditPlayer?: (playerId: string) => void;
}

type NavigationKey = 'dashboard' | 'inbox' | 'squad' | 'profiles' | 'tactics' | 'fixtures' | 'competitions' | 'transfers' | 'finances';
const navigation: { key: NavigationKey; label: string; icon: IconName }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'squad', label: 'Squad', icon: 'squad' }, { key: 'profiles', label: 'Player Profiles', icon: 'profile' },
  { key: 'tactics', label: 'Tactics', icon: 'tactics' }, { key: 'fixtures', label: 'Fixtures', icon: 'fixtures' },
  { key: 'competitions', label: 'Competitions', icon: 'competitions' }, { key: 'transfers', label: 'Transfers', icon: 'transfers' },
  { key: 'finances', label: 'Finances', icon: 'finances' },
];
const futureScreens = {
  tactics: { number: '02', title: 'A shape for the next chapter.', description: 'Choose a formation, assign player roles and shape how your team plays. Tactical decisions and their match consequences will arrive with the simulation milestone.', features: ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '3-5-2'] },
  fixtures: { number: '03', title: 'The season is still ahead.', description: 'A season of fixtures, matchdays and results belongs to a later milestone. There are no scheduled matches in this foundation build.', features: ['No fixtures scheduled', 'No fabricated results'] },
  competitions: { number: '03', title: 'Build the football world.', description: 'Leagues, cup competitions and tables will follow the foundation review. This reference database does not establish a current competition world.', features: ['Typed league & cup models', 'Source-aware competition data'] },
  transfers: { number: '04', title: 'The right player. The right deal.', description: 'Transfers, contracts, scouting and AI squad management are planned management systems. There are no live negotiations, invented valuations or transfer recommendations in this foundation build.', features: ['Planned management system', 'No live transfer market'] },
  finances: { number: '04', title: 'Every penny accounted for.', description: 'Track club income, wages and spending as your career develops. Budgets and balances are unknown in this reference database; financial management is planned for a later milestone.', features: ['Integer monetary values', 'Unknown budgets remain unknown'] },
} as const;

function FileButton({ label, icon, onFile }: { label: string; icon: IconName; onFile: (file: File) => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <><button className={styles.button} onClick={() => inputRef.current?.click()}><Icon name={icon} className={styles.buttonIcon} />{label}</button><input className={styles.fileInput} aria-label={label} ref={inputRef} tabIndex={-1} type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (file) void onFile(file); event.target.value = ''; }} /></>;
}

function SourcePanel({ snapshot }: { snapshot: DatabaseSnapshot }) {
  return <section className={styles.panel} aria-labelledby="source-panel-title"><header className={styles.panelHead}><h2 className={styles.panelTitle} id="source-panel-title">Know your database</h2></header><div className={styles.panelBody}>
    <span className={styles.smallLabel}>Current snapshot</span><p className={styles.policyNote}><strong>{snapshot.name}</strong><br />{snapshot.players.length} real-player records · {snapshot.clubs.length} club identities</p>
    <dl className={styles.defList}><div><dt>Target season</dt><dd>{snapshot.season}</dd></div><div><dt>Created</dt><dd>{readableDate(snapshot.createdAt)}</dd></div><div><dt>Format</dt><dd>Database v{snapshot.schemaVersion}</dd></div><div><dt>Squad coverage</dt><dd>{snapshot.validation.status === 'reference-only' ? 'Unverified / incomplete' : 'See imported provenance'}</dd></div></dl>

    {snapshot.sources.map((source, index) => <p className={styles.profileFootnote} key={`${source.sourceId}-${index}`}><a href={source.url} target="_blank" rel="noreferrer">{source.sourceName} ↗</a><br />{source.license.name}{source.license.usageRestrictions.length ? ` · ${source.license.usageRestrictions.join('; ')}` : ''}</p>)}
  </div></section>;
}

function ClubSelection({ snapshot, onSelectClub, onImportDatabase, onImportSave }: Pick<GameShellProps, 'snapshot' | 'onSelectClub' | 'onImportDatabase' | 'onImportSave'>) {
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const selected = snapshot.clubs.find(club => club.id === selectedClub);
  return <>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Welcome to Touchline</span><h1 className={styles.pageTitle}>Your next chapter.</h1></div><div className={styles.pageActions}><FileButton label="Import database" icon="upload" onFile={onImportDatabase} /><FileButton label="Restore save" icon="upload" onFile={onImportSave} /></div></div>
    <section className={`${styles.hero} ${styles.selectionHero}`}><div><h2>Every career starts at a club.</h2><p>Explore real-player records, original assessments and local saves. Match simulation comes later.</p></div><span className={styles.heroMeta}>Milestone 01</span></section>
    <div className={styles.chooseGrid}><section className={styles.panel} aria-labelledby="choose-club-title"><header className={styles.panelHead}><h2 className={styles.panelTitle} id="choose-club-title">Choose your club</h2><span className={styles.panelAside}>{snapshot.clubs.length} available identities</span></header><div className={styles.clubList}>
      {snapshot.clubs.map(club => <button className={`${styles.clubOption} ${selectedClub === club.id ? styles.clubOptionSelected : ''}`} key={club.id} aria-pressed={selectedClub === club.id} onClick={() => setSelectedClub(club.id)}><span className={styles.clubOptionCrest} aria-hidden="true">{initials(club.shortName)}</span><span><span className={styles.clubOptionName}>{club.name}</span><span className={styles.clubOptionMeta}>{club.country} · Club identity only</span></span><span className={styles.clubOptionCheck} aria-hidden="true">{selectedClub === club.id ? '✓' : ''}</span></button>)}
      {snapshot.clubs.length === 0 && <div className={styles.empty}>No club identities in this snapshot. Import a valid database containing a club to begin.</div>}
    </div><footer className={styles.clubSelectionFooter}><span>{selected ? `${selected.shortName} selected` : 'Select a club to continue'}<br />{snapshot.validation.status === 'reference-only' ? 'No verified 2026/27 squads supplied.' : 'Assignments come from the imported snapshot.'}</span><button className={`${styles.button} ${styles.primaryButton}`} disabled={!selected} onClick={() => { if (selected) void onSelectClub(selected.id); }}>Begin career<Icon name="arrow" className={styles.buttonIcon} /></button></footer></section><SourcePanel snapshot={snapshot} /></div>

  </>;
}

function Dashboard({ club, career, snapshot, onNavigate, onOpenPlayer }: { club: Club | undefined; career: GameState; snapshot: DatabaseSnapshot; onNavigate: (key: NavigationKey) => void; onOpenPlayer: (id: string) => void }) {
  const squadCount = snapshot.players.filter(player => player.clubId === career.managedClubId).length;
  const totalAssessed = snapshot.players.reduce((count, player) => count + assessedCount(player), 0);
  return <>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Club overview</span><h1 className={styles.pageTitle}>Manager’s desk</h1><p className={styles.pageSubtitle}>{club?.name ?? 'Your club'} · Local foundation career</p></div><span className={`${styles.chip} ${styles.mutedChip}`}>Career date · {readableDate(career.currentDate)}</span></div>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Welcome to the club</span><h2>{club?.name ?? 'A new beginning'}</h2><p>The foundations are in place. Explore the reference players, inspect every attribute and build your first original assessments.</p></div><div className={styles.heroCrest} aria-hidden="true">{initials(club?.shortName ?? 'TC')}</div></section>
    <div className={styles.metricGrid}><div className={styles.metric}><span className={styles.metricLabel}>Reference players</span><strong className={styles.metricValue}>{snapshot.players.length}</strong><span className={styles.metricDetail}>Real identities · sourced records</span></div><div className={styles.metric}><span className={styles.metricLabel}>Managed squad</span><strong className={styles.metricValue}>{squadCount ? squadCount : '—'}</strong><span className={styles.metricDetail}>{squadCount ? 'Imported club assignments' : 'No verified current assignments'}</span></div><div className={styles.metric}><span className={styles.metricLabel}>Attributes assessed</span><strong className={styles.metricValue}>{totalAssessed}<span style={{ font: '11px -apple-system, sans-serif', color: '#5f6d55', marginLeft: 5 }}>/ {snapshot.players.length * 45}</span></strong><span className={styles.metricDetail}>Original game estimates · 1–20</span></div></div>
    <div className={styles.grid}><div><section className={styles.panel}><header className={styles.panelHead}><h2 className={styles.panelTitle}>Your first day</h2><button className={styles.textLink} onClick={() => onNavigate('inbox')}>Open inbox →</button></header>
      <div className={styles.activity}><span className={styles.activityIndex}>01</span><div><h3 className={styles.activityTitle}>Get to know the players</h3><p className={styles.activityText}>Browse {snapshot.players.length} real-player records in the reference directory. Current club assignments remain unknown.</p><button className={styles.textLink} style={{ marginTop: 8 }} onClick={() => onNavigate('squad')}>View player directory →</button></div></div>
      <div className={styles.activity}><span className={styles.activityIndex}>02</span><div><h3 className={styles.activityTitle}>Look beyond the headline rating</h3><p className={styles.activityText}>45 technical, mental, physical and goalkeeping attributes. Unknown values stay unknown until assessed.</p>{snapshot.players[0] && <button className={styles.textLink} style={{ marginTop: 8 }} onClick={() => onOpenPlayer(snapshot.players[0]!.id)}>Open a player profile →</button>}</div></div>
      <div className={styles.activity}><span className={styles.activityIndex}>03</span><div><h3 className={styles.activityTitle}>Keep your career close</h3><p className={styles.activityText}>Your career is stored locally. Export a backup from the toolbar, then restore it on another device.</p></div></div>
    </section><section className={`${styles.panel} ${styles.sectionGap}`}><header className={styles.panelHead}><h2 className={styles.panelTitle}>Next fixture</h2><span className={`${styles.chip} ${styles.mutedChip}`}>Next milestone</span></header><div className={styles.panelBody}><p className={styles.activityText}>The match engine and playable schedule will follow the foundation review. There are no scheduled matches or simulated results in this build.</p></div></section></div>
      <section className={styles.panel}><header className={styles.panelHead}><h2 className={styles.panelTitle}>Club & career</h2></header><div className={styles.panelBody}><dl className={styles.defList}><div><dt>Club</dt><dd>{club?.name ?? 'Unknown'}</dd></div><div><dt>Country</dt><dd>{club?.country ?? 'Unknown'}</dd></div><div><dt>Stadium</dt><dd>{club?.stadium ?? 'Unknown'}</dd></div><div><dt>Squad data</dt><dd><span className={`${styles.chip} ${styles.mutedChip}`}>{squadCount ? 'Imported' : 'Unverified'}</span></dd></div><div><dt>Transfer budget</dt><dd>Unknown</dd></div><div><dt>Database</dt><dd>Version {snapshot.schemaVersion}</dd></div><div><dt>Save format</dt><dd>Version {career.schemaVersion}</dd></div></dl><p className={`${styles.profileFootnote} ${styles.sectionGap}`}>Club identity does not verify a current squad, a budget or a competition entry. Sourced facts and game estimates remain separate.</p></div></section>
    </div>
  </>;
}

const inboxMessages = [
  { sender: 'Touchline / getting started', subject: 'Welcome to your new career', title: 'A club. A notebook. A beginning.', paragraphs: ['Your local career has begun. This first milestone establishes the structure for a lasting football world: typed player records, transparent attributes and portable career saves.', 'Start in Squad to browse the reference directory. Open a player profile to inspect all 45 attributes, choose a role and review the source behind the record.'] },
  { sender: 'Database / provenance', subject: 'A note on the reference database', title: 'Good decisions start with honest data.', paragraphs: ['The bundled records are a small, sourced reference dataset. They do not verify current 2026/27 squads, and no invented players fill the gaps. The managed club’s squad may therefore be empty.', 'An em dash means unknown or unassessed. Biography is sourced; numeric attribute assessments are original game estimates. Import a suitable licensed snapshot to expand the database.'] },
  { sender: 'Development / milestone 01', subject: 'What comes after the foundation', title: 'The match engine comes next.', paragraphs: ['Tactics, fixtures, competitions, transfers and finances have navigation destinations and typed foundations. Their playable systems are planned for later milestones.', 'The next step is to review the interface, data structures and attribute calibration before implementing an attribute-driven event simulation. No calendar or match progression is enabled in this build.'] },
];
function Inbox() {
  const [selected, setSelected] = useState(0);
  const message = inboxMessages[selected]!;
  return <><div className={styles.pageHeader}><div><span className={styles.eyebrow}>Club communications</span><h1 className={styles.pageTitle}>Inbox</h1><p className={styles.pageSubtitle}>Foundation notes from Touchline. No simulated club correspondence.</p></div><span className={styles.chip}>3 system notes</span></div><section className={styles.panel}><header className={styles.panelHead}><h2 className={styles.panelTitle}>System messages</h2><span className={styles.panelAside}>Milestone 01</span></header><div className={styles.inboxLayout}><div className={styles.inboxList} role="group" aria-label="Inbox messages">{inboxMessages.map((item, index) => <button key={item.subject} className={`${styles.inboxItem} ${index === selected ? styles.inboxItemActive : ''}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><span className={styles.inboxSender}>{item.sender}</span><span className={styles.inboxSubject}>{item.subject}</span></button>)}</div><article className={styles.inboxMessage} aria-live="polite"><span className={styles.messageTag}>{message.sender} · System note</span><h2>{message.title}</h2>{message.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</article></div></section></>;
}

export function GameShell({ snapshot, career, storageStatus, appNotice, onSelectClub, onImportDatabase, onImportSave, onExportSave, onNewCareer, onSelectPlayer, onEditPlayer }: GameShellProps) {
  const [activeNav, setActiveNav] = useState<NavigationKey>('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const club = snapshot.clubs.find(item => item.id === career?.managedClubId);
  const selectedPlayer = snapshot.players.find(player => player.id === selectedPlayerId) ?? snapshot.players[0];
  const activeLabel = navigation.find(item => item.key === activeNav)?.label ?? 'Dashboard';
  function openPlayer(id: string) { setSelectedPlayerId(id); setActiveNav('profiles'); onSelectPlayer?.(id); }
  const future = activeNav in futureScreens ? futureScreens[activeNav as keyof typeof futureScreens] : null;
  const currentDate = career?.currentDate ?? snapshot.createdAt.slice(0, 10);
  return <div className={styles.shell}>
    <div className={styles.brand} role="complementary" aria-label="Touchline brand"><span className={styles.brandMark} aria-hidden="true">t</span><div className={styles.brandWords}><span className={styles.brandTitle}>TOUCHLINE</span><span className={styles.brandSub}>FOOTBALL MANAGEMENT</span></div></div>
    <header className={styles.topbar}><div className={styles.breadcrumb}><span>{club?.shortName ?? 'The manager’s office'}</span><span aria-hidden="true">/</span><strong>{career ? activeLabel : 'New career'}</strong></div><div className={styles.topMeta}><span><span className={styles.localDot} />LOCAL CAREER</span><span>{readableDate(currentDate).toUpperCase()}</span><span className={styles.buildTag}>FOUNDATION · 01</span></div></header>
    <aside className={styles.sidebar}><div className={styles.sidebarLabel}>MANAGEMENT</div><nav className={styles.nav} aria-label="Primary navigation">{navigation.map(item => <button key={item.key} className={`${styles.navButton} ${item.key === activeNav ? styles.navButtonActive : ''}`} disabled={!career} aria-current={career && item.key === activeNav ? 'page' : undefined} title={!career ? 'Choose a club to begin' : item.label} onClick={() => setActiveNav(item.key)}><Icon name={item.icon} className={styles.navIcon} /><span className={styles.navText}>{item.label}</span>{item.key === 'inbox' && <span className={styles.navCount}>3</span>}</button>)}</nav><div className={styles.sidebarBottom}><div className={styles.clubMini}><span className={styles.miniCrest} aria-hidden="true">{initials(club?.shortName ?? 'Your club')}</span><span className={styles.miniTitle}>{club?.shortName ?? 'Your club awaits'}<span className={styles.miniSub}>{career ? 'LOCAL SAVE · V1' : 'A NEW BEGINNING'}</span></span></div></div></aside>
    <main className={styles.content} id="main-content">
      <div className={styles.notice}><Icon name="info" className={styles.noticeIcon} /><span><strong>{snapshot.validation.status === 'reference-only' ? 'Reference database • no verified 2026/27 squads' : `Imported database • ${snapshot.season}`}</strong><span> · {snapshot.validation.status === 'reference-only' ? 'Real identities. Unknown ratings stay unassessed.' : 'Source rights and factual accuracy remain the importer’s responsibility.'}</span></span></div>
      {appNotice && <div role={appNotice.kind === 'error' ? 'alert' : 'status'} className={`${styles.notice} ${appNotice.kind === 'error' ? styles.noticeError : appNotice.kind === 'success' ? styles.noticeSuccess : ''}`}><Icon name="info" className={styles.noticeIcon} /><span>{appNotice.text}</span></div>}
      {career && <div className={styles.pageActions} style={{ marginBottom: 16 }}><FileButton label="Import database" icon="upload" onFile={onImportDatabase} /><FileButton label="Restore save" icon="upload" onFile={onImportSave} /><button className={styles.button} onClick={() => void onExportSave()}><Icon name="download" className={styles.buttonIcon} />Export save</button><button className={styles.button} onClick={() => { setActiveNav('dashboard'); void onNewCareer(); }}>Change club</button></div>}
      {!career ? <ClubSelection key={snapshot.id} snapshot={snapshot} onSelectClub={onSelectClub} onImportDatabase={onImportDatabase} onImportSave={onImportSave} />
        : activeNav === 'dashboard' ? <Dashboard club={club} career={career} snapshot={snapshot} onNavigate={setActiveNav} onOpenPlayer={openPlayer} />
        : activeNav === 'inbox' ? <Inbox />
        : activeNav === 'squad' ? <><div className={styles.pageHeader}><div><span className={styles.eyebrow}>Players & assessment</span><h1 className={styles.pageTitle}>Squad & player directory</h1><p className={styles.pageSubtitle}>Compact records. Individual attributes. A clearer view of every player.</p></div></div><SquadTable snapshot={snapshot} clubId={career.managedClubId} currentDate={career.currentDate} onSelectPlayer={openPlayer} /></>
        : activeNav === 'profiles' ? selectedPlayer ? <PlayerProfile key={selectedPlayer.id} player={visiblePlayer(selectedPlayer)} snapshot={snapshot} currentDate={career.currentDate} onBack={() => setActiveNav('squad')} onEditPlayer={onEditPlayer} /> : <section className={styles.panel}><div className={styles.empty}><h3>No player records available.</h3><p>Import a validated, appropriately licensed database to inspect player profiles.</p></div></section>
        : future ? <><div className={styles.pageHeader}><div><span className={styles.eyebrow}>The football world</span><h1 className={styles.pageTitle}>{activeLabel}</h1><p className={styles.pageSubtitle}>A prepared foundation. A later playable milestone.</p></div><span className={`${styles.chip} ${styles.mutedChip}`}>Planned feature</span></div><section className={`${styles.panel} ${styles.placeholderPanel}`}><div className={styles.placeholderNumber} aria-hidden="true">{future.number}</div><h2 className={styles.placeholderTitle}>{future.title}</h2><p>{future.description}</p><div className={styles.placeholderFooter}>{future.features.map(feature => <span className={`${styles.chip} ${styles.mutedChip}`} key={feature}>{feature}</span>)}</div></section></> : null}
    </main>
    <footer className={styles.statusbar}><span className={styles.statusItem}><span className={styles.statusDot} />{storageStatus}</span><span>{snapshot.players.length} PLAYERS · {snapshot.clubs.length} CLUBS · DATABASE V{snapshot.schemaVersion}</span><span>TOUCHLINE / MILESTONE 01</span></footer>
  </div>;
}
