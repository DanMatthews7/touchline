import { useEffect, useRef, useState } from 'react';
import { ZodError } from 'zod';
import { createEditorialAssessment, parseSnapshot } from './data';
import { ATTRIBUTE_GROUPS, getAttributeValue, type DatabaseSnapshot, type GameState, type ProvenanceRecord } from './domain';
import { TouchlineRepository, createCareer, exportSave, importSave, MAX_SAVE_BYTES } from './persistence';
import { GameShell } from './ui/GameShell';
import AttributeEditor, { type EditorialInput } from './AttributeEditor';
import referenceInput from './reference/snapshot.json';

const referenceSnapshot = parseSnapshot(referenceInput);
type Notice = { kind: 'success' | 'error' | 'info'; text: string };

function errorMessage(cause: unknown): string {
  if (cause instanceof ZodError) return `Import rejected: ${cause.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'file'}: ${issue.message}`).join(' ')} Existing saves are unchanged.`;
  return cause instanceof Error ? cause.message : 'The operation could not be completed.';
}

async function readJsonFile(file: File): Promise<string> {
  if (file.size > MAX_SAVE_BYTES) throw new Error('Import exceeds the 16 MiB limit.');
  return file.text();
}

export default function App() {
  const [repository] = useState(() => new TouchlineRepository());
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot>(referenceSnapshot);
  const [career, setCareer] = useState<GameState | null>(null);
  const [storageStatus, setStorageStatus] = useState('Opening local storage…');
  const [notice, setNotice] = useState<Notice>();
  const [ready, setReady] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const operationRunning = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await repository.saveSnapshot(referenceSnapshot);
        const latest = (await repository.listCareers())[0];
        if (latest) {
          const saved = await repository.loadCareer(latest.id);
          const savedSnapshot = saved && await repository.loadSnapshot(saved.databaseSnapshotId);
          if (active && saved && savedSnapshot) { setSnapshot(savedSnapshot); setCareer(saved); }
        }
        if (active) setStorageStatus('IndexedDB · saved on this device');
      } catch (cause) {
        if (active) {
          setStorageStatus('Local storage unavailable');
          setNotice({ kind: 'error', text: `Local storage could not be opened. ${errorMessage(cause)} Check browser storage permissions before creating a career.` });
        }
      } finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, [repository]);

  async function runOperation(operation: () => Promise<void>) {
    if (operationRunning.current) return;
    operationRunning.current = true;
    try { await operation(); }
    catch (cause) { setNotice({ kind: 'error', text: errorMessage(cause) }); }
    finally { operationRunning.current = false; }
  }

  async function selectClub(clubId: string) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const next = createCareer(snapshot, clubId, seed);
    await repository.save(snapshot, next);
    setCareer(next);
    setStorageStatus('IndexedDB · saved on this device');
    setNotice({ kind: 'success', text: 'Career created and saved locally. The reference database does not contain verified current squads.' });
  }

  async function importDatabase(file: File) {
    let candidate: unknown;
    try { candidate = JSON.parse(await readJsonFile(file)) as unknown; }
    catch (cause) { if (cause instanceof SyntaxError) throw new Error('Database file is not valid JSON.'); throw cause; }
    const next = parseSnapshot(candidate);
    await repository.saveSnapshot(next);
    setSnapshot(next);
    setCareer(null);
    setEditingPlayerId(null);
    setNotice({ kind: 'success', text: `Validated ${next.players.length} player records and ${next.clubs.length} clubs. Choose a club to create a career. Previous careers remain saved.` });
  }

  async function restoreSave(file: File) {
    const envelope = importSave(await readJsonFile(file));
    await repository.save(envelope.snapshot, envelope.career);
    setSnapshot(envelope.snapshot);
    setCareer(envelope.career);
    setEditingPlayerId(null);
    setStorageStatus('IndexedDB · saved on this device');
    setNotice({ kind: 'success', text: 'Save restored and validated. Its original database, club selection and simulation seed are preserved.' });
  }

  function downloadSave() {
    if (!career) return;
    const blob = new Blob([exportSave(snapshot, career)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `touchline-${career.id}-${career.currentDate}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ kind: 'success', text: 'Save exported with its versioned source database. Keep a backup before clearing browser storage.' });
  }

  async function applyAssessment(input: EditorialInput) {
    if (operationRunning.current) throw new Error('Another save is in progress. Try again shortly.');
    operationRunning.current = true;
    try {
      const player = snapshot.players.find(item => item.id === editingPlayerId);
      if (!player || !career) throw new Error('Select a player in an active career first.');
      const now = new Date().toISOString();
      const sourceId = 'touchline-local-editorial';
      const source: ProvenanceRecord = {
        sourceId, sourceName: 'Touchline local editorial input — original game design',
        url: 'https://github.com/DanMatthews7/touchline', accessedAt: now, sourceDate: now.slice(0, 10), externalId: null,
        license: { name: 'User-authored assessment; review before redistribution', url: null, usageRestrictions: ['Original game estimates entered by the local user; not verified biographical facts.'] },
      };
      const assessments = { ...player.attributeAssessments };
      for (const group of ATTRIBUTE_GROUPS) {
        for (const attribute of group.attributes) {
          const next = getAttributeValue(input.attributes, attribute.path);
          if (next === null) delete assessments[attribute.path];
          else if (next !== getAttributeValue(player.attributes, attribute.path)) assessments[attribute.path] = createEditorialAssessment({
            confidence: input.confidence, method: input.method, evidenceSourceIds: [sourceId], assessedAt: now,
          });
        }
      }
      const revised = parseSnapshot({
        ...snapshot,
        id: `editorial-${crypto.randomUUID()}`,
        name: `${snapshot.name.replace(/ · local assessment$/, '').slice(0, 210)} · local assessment`,
        createdAt: now,
        sources: snapshot.sources.some(item => item.sourceId === sourceId) ? snapshot.sources : [...snapshot.sources, source],
        players: snapshot.players.map(item => item.id === player.id ? { ...item, attributes: input.attributes, attributeAssessments: assessments } : item),
      });
      const revisedCareer = { ...career, databaseSnapshotId: revised.id, updatedAt: now };
      await repository.save(revised, revisedCareer);
      setSnapshot(revised);
      setCareer(revisedCareer);
      setEditingPlayerId(null);
      setNotice({ kind: 'success', text: 'Original game assessment saved in a new database revision. Sourced biographical records are unchanged.' });
    } finally { operationRunning.current = false; }
  }

  if (!ready) return <main style={{ padding: 32, color: '#193f2c' }} aria-live="polite">Opening Touchline’s local database…</main>;
  const editingPlayer = snapshot.players.find(player => player.id === editingPlayerId);
  return <>
    <GameShell snapshot={snapshot} career={career} storageStatus={storageStatus} appNotice={notice}
      onSelectClub={clubId => { void runOperation(() => selectClub(clubId)); }}
      onImportDatabase={file => { void runOperation(() => importDatabase(file)); }}
      onImportSave={file => { void runOperation(() => restoreSave(file)); }}
      onExportSave={() => { void runOperation(async () => downloadSave()); }}
      onNewCareer={() => { setCareer(null); setNotice({ kind: 'info', text: 'Choose a club for a new career. Your previous careers remain in local storage.' }); }}
      onEditPlayer={setEditingPlayerId}
    />
    {editingPlayer && <AttributeEditor key={editingPlayer.id} player={editingPlayer} onApply={applyAssessment} onClose={() => setEditingPlayerId(null)} />}
  </>;
}
