/** Original attribute vocabulary. Ratings describe this game's model, never a source's facts. */
export const TECHNICAL_ATTRIBUTES = ['corners', 'crossing', 'dribbling', 'finishing', 'firstTouch', 'freeKicks', 'heading', 'longShots', 'longThrows', 'marking', 'passing', 'penalties', 'tackling', 'technique'] as const;
export const MENTAL_ATTRIBUTES = ['aggression', 'anticipation', 'bravery', 'composure', 'concentration', 'decisions', 'determination', 'flair', 'leadership', 'offTheBall', 'positioning', 'teamwork', 'vision', 'workRate'] as const;
export const PHYSICAL_ATTRIBUTES = ['acceleration', 'agility', 'balance', 'jumpingReach', 'naturalFitness', 'pace', 'stamina', 'strength'] as const;
export const GOALKEEPING_ATTRIBUTES = ['aerialReach', 'commandOfArea', 'communication', 'handling', 'kicking', 'oneOnOnes', 'reflexes', 'rushingOut', 'throwing'] as const;

export const ATTRIBUTE_KEYS = { technical: TECHNICAL_ATTRIBUTES, mental: MENTAL_ATTRIBUTES, physical: PHYSICAL_ATTRIBUTES, goalkeeping: GOALKEEPING_ATTRIBUTES } as const;
export type AttributeGroup = keyof typeof ATTRIBUTE_KEYS;
export type AttributeKey<G extends AttributeGroup> = (typeof ATTRIBUTE_KEYS)[G][number];
export type AttributePath = { [G in AttributeGroup]: `${G}.${AttributeKey<G>}` }[AttributeGroup];
/** Null means unassessed; it must never silently become an average rating. */
export type AttributeValue = number | null;
export type PlayerAttributes = { [G in AttributeGroup]: Record<AttributeKey<G>, AttributeValue> };

export const ATTRIBUTE_LABELS: Record<AttributePath, string> = {
  'technical.corners': 'Corners', 'technical.crossing': 'Crossing', 'technical.dribbling': 'Dribbling', 'technical.finishing': 'Finishing', 'technical.firstTouch': 'First Touch', 'technical.freeKicks': 'Free Kicks', 'technical.heading': 'Heading', 'technical.longShots': 'Long Shots', 'technical.longThrows': 'Long Throws', 'technical.marking': 'Marking', 'technical.passing': 'Passing', 'technical.penalties': 'Penalties', 'technical.tackling': 'Tackling', 'technical.technique': 'Technique',
  'mental.aggression': 'Aggression', 'mental.anticipation': 'Anticipation', 'mental.bravery': 'Bravery', 'mental.composure': 'Composure', 'mental.concentration': 'Concentration', 'mental.decisions': 'Decisions', 'mental.determination': 'Determination', 'mental.flair': 'Flair', 'mental.leadership': 'Leadership', 'mental.offTheBall': 'Off the Ball', 'mental.positioning': 'Positioning', 'mental.teamwork': 'Teamwork', 'mental.vision': 'Vision', 'mental.workRate': 'Work Rate',
  'physical.acceleration': 'Acceleration', 'physical.agility': 'Agility', 'physical.balance': 'Balance', 'physical.jumpingReach': 'Jumping Reach', 'physical.naturalFitness': 'Natural Fitness', 'physical.pace': 'Pace', 'physical.stamina': 'Stamina', 'physical.strength': 'Strength',
  'goalkeeping.aerialReach': 'Aerial Reach', 'goalkeeping.commandOfArea': 'Command of Area', 'goalkeeping.communication': 'Communication', 'goalkeeping.handling': 'Handling', 'goalkeeping.kicking': 'Kicking', 'goalkeeping.oneOnOnes': 'One-on-Ones', 'goalkeeping.reflexes': 'Reflexes', 'goalkeeping.rushingOut': 'Rushing Out', 'goalkeeping.throwing': 'Throwing',
};

export const ATTRIBUTE_GROUPS = (Object.keys(ATTRIBUTE_KEYS) as AttributeGroup[]).map(group => ({
  id: group,
  label: group[0]!.toUpperCase() + group.slice(1),
  attributes: ATTRIBUTE_KEYS[group].map(key => ({ key, path: `${group}.${key}` as AttributePath, label: ATTRIBUTE_LABELS[`${group}.${key}` as AttributePath] })),
}));

export const ALL_ATTRIBUTE_PATHS = ATTRIBUTE_GROUPS.flatMap(group => group.attributes.map(attribute => attribute.path));

export function createUnknownAttributes(): PlayerAttributes {
  return Object.fromEntries(Object.entries(ATTRIBUTE_KEYS).map(([group, keys]) => [group, Object.fromEntries(keys.map(key => [key, null]))])) as PlayerAttributes;
}

export function isAttributeValue(value: unknown): value is AttributeValue {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20);
}

export function getAttributeValue(attributes: PlayerAttributes, path: AttributePath): AttributeValue {
  const [group, key] = path.split('.') as [AttributeGroup, string];
  return (attributes[group] as Record<string, AttributeValue>)[key] ?? null;
}

export interface AttributeAssessment {
  status: 'original-estimate' | 'editorial-override';
  confidence: 'low' | 'medium' | 'high';
  method: string;
  evidenceSourceIds: string[];
  assessedAt: string;
}

export type AttributeAssessments = Partial<Record<AttributePath, AttributeAssessment>>;
