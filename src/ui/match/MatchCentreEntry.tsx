import { useMemo } from 'react';
import type { Player } from '../../domain/models';
import { parseSnapshot } from '../../data';
import exhibitionInput from '../../reference/exhibition-snapshot.json';
import { MatchCentre } from './MatchCentre';

const exhibitionPool = parseSnapshot(exhibitionInput);

/** Load the larger sourced pool only on Matchday; career-owned assessments take priority. */
export default function MatchCentreEntry({ careerPlayers }: { careerPlayers: Player[] }) {
  const catalogue = useMemo(() => {
    const identities = new Map(exhibitionPool.players.map(player => [player.id, player]));
    for (const player of careerPlayers) identities.set(player.id, player);
    return [...identities.values()];
  }, [careerPlayers]);
  return <MatchCentre catalogue={catalogue} />;
}
