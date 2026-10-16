import type { MatchEvent, MatchSide, MatchState, MatchStats, MatchSummary } from './types';

function emptyStats(): MatchStats {
  return {
    possession: 50, passesAttempted: 0, passesCompleted: 0, tacklesAttempted: 0,
    tacklesWon: 0, chances: 0, shots: 0, shotsOnTarget: 0, expectedGoals: 0,
    saves: 0, fouls: 0, yellowCards: 0, redCards: 0,
  };
}

/** The event stream is authoritative: no score or statistic is simulated again here. */
export function getMatchSummary(state: Pick<MatchState, 'events'>): MatchSummary {
  const score = { home: 0, away: 0 };
  const stats = { home: emptyStats(), away: emptyStats() };
  const possessions = { home: 0, away: 0 };
  for (const event of state.events) {
    if (!('team' in event)) continue;
    const side = stats[event.team];
    switch (event.type) {
      case 'POSSESSION': possessions[event.team]++; break;
      case 'PASS': side.passesAttempted++; if (event.completed) side.passesCompleted++; break;
      case 'TACKLE': side.tacklesAttempted++; if (event.won) side.tacklesWon++; break;
      case 'CHANCE': side.chances++; break;
      case 'SHOT': side.shots++; if (event.onTarget) side.shotsOnTarget++; side.expectedGoals += event.expectedGoals; break;
      case 'SAVE': side.saves++; break;
      case 'GOAL': score[event.team]++; break;
      case 'FOUL': side.fouls++; break;
      case 'CARD':
        if (event.card !== 'red') side.yellowCards++;
        if (event.card !== 'yellow') side.redCards++;
        break;
    }
  }
  const totalPossessions = possessions.home + possessions.away;
  if (totalPossessions > 0) {
    stats.home.possession = 100 * possessions.home / totalPossessions;
    stats.away.possession = 100 - stats.home.possession;
  }
  return { score, stats };
}

/** Names are the only contextual lookup; all football claims come from this event. */
export function commentaryForEvent(state: Pick<MatchState, 'config'>, event: MatchEvent): string {
  const playerName = (id: string): string => state.config.home.players.find(player => player.id === id)?.name
    ?? state.config.away.players.find(player => player.id === id)?.name ?? id;
  const teamName = (side: MatchSide): string => state.config[side].name;
  let text: string;
  switch (event.type) {
    case 'KICKOFF': text = `${teamName(event.team)} kick off.`; break;
    case 'POSSESSION': text = `${teamName(event.team)} have possession.`; break;
    case 'PASS': text = event.completed
      ? `${playerName(event.playerId)} finds ${playerName(event.recipientId)} with a pass.`
      : `${playerName(event.playerId)} cannot find ${playerName(event.recipientId)} with the pass.`; break;
    case 'TACKLE': text = event.won
      ? `${playerName(event.playerId)} wins the ball from ${playerName(event.opponentId)}.`
      : `${playerName(event.opponentId)} evades ${playerName(event.playerId)}'s tackle.`; break;
    case 'CHANCE': text = `${playerName(event.playerId)} has a chance for ${teamName(event.team)}.`; break;
    case 'SHOT': text = `${playerName(event.playerId)} shoots ${event.onTarget ? 'on target' : 'off target'}.`; break;
    case 'SAVE': text = `${playerName(event.playerId)} saves ${playerName(event.shooterId)}'s shot.`; break;
    case 'GOAL': text = `Goal for ${teamName(event.team)}! ${playerName(event.playerId)} scores.`; break;
    case 'FOUL': text = `${playerName(event.playerId)} fouls ${playerName(event.fouledPlayerId)}.`; break;
    case 'CARD': text = event.card === 'second-yellow'
      ? `${playerName(event.playerId)} receives a second yellow card and is sent off.`
      : `${playerName(event.playerId)} receives a ${event.card} card${event.card === 'red' ? ' and is sent off' : ''}.`; break;
    case 'FATIGUE': text = `${playerName(event.playerId)}'s condition is ${event.condition.toFixed(1)}%.`; break;
    case 'SUBSTITUTION': text = `${teamName(event.team)} replace ${playerName(event.playerOutId)} with ${playerName(event.playerInId)}.`; break;
    case 'TACTICS_CHANGED': text = `${teamName(event.team)} switch to ${event.formation}, with ${event.instructions.mentality} mentality, ${event.instructions.tempo} tempo, ${event.instructions.width} width, ${event.instructions.pressingIntensity} pressing and a ${event.instructions.defensiveLine} defensive line.`; break;
    case 'CHECKPOINT': text = 'Play pauses for tactical decisions.'; break;
    case 'FULL_TIME': text = 'Full time.'; break;
    case 'ABANDONED': text = `Match abandoned: ${teamName(event.team)} have fewer than seven players.`; break;
  }
  return `${event.minute}′ ${text}`;
}
