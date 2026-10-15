import type { CSSProperties } from 'react';

export type IconName = 'dashboard' | 'inbox' | 'squad' | 'profile' | 'tactics' | 'fixtures' | 'competitions' | 'transfers' | 'finances' | 'download' | 'upload' | 'arrow' | 'search' | 'info';
const paths: Record<IconName, string[]> = {
  dashboard: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  inbox: ['M4 4h16l2 11v5H2v-5L4 4Z', 'M2 15h6l2 3h4l2-3h6'],
  squad: ['M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  profile: ['M5 3h14v18H5z', 'M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 17c0-4 8-4 8 0'],
  tactics: ['M3 3h18v18H3zM3 12h18M12 3v18', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  fixtures: ['M4 5h16v16H4zM4 10h16M8 2v6M16 2v6M8 14h2M14 14h2M8 17h2'],
  competitions: ['M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v6M7 21h10'],
  transfers: ['M3 7h17M15 2l5 5-5 5M21 17H4M9 12l-5 5 5 5'],
  finances: ['M3 5h18v15H3zM3 9h18M15 15h3M7 15h2'],
  download: ['M12 3v12M7 10l5 5 5-5M4 15v6h16v-6'],
  upload: ['M12 16V4M7 9l5-5 5 5M4 16v5h16v-5'],
  arrow: ['M4 12h16M14 6l6 6-6 6'],
  search: ['M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM15 15l6 6'],
  info: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6M12 7h.01'],
};

export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name].map((path, index) => <path d={path} key={index} />)}</svg>;
}
