import type { ReactNode } from 'react';
import type { Member } from '../domain/types';

export function Card({
  children,
  variant,
  tight,
}: {
  children: ReactNode;
  variant?: 'hint' | 'gate' | 'banner' | 'error';
  tight?: boolean;
}) {
  return (
    <div className={['card', tight ? 'tight' : '', variant ?? ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function Avatar({ member }: { member: Member }) {
  return (
    <span className="avatar" style={{ background: member.avatarColor }} aria-hidden="true">
      {member.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Pill({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'good' | 'warn' | 'bad' | 'gold';
}) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

export function Meter({ percent }: { percent: number }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Card variant="error" tight>
      {message}
    </Card>
  );
}

/** Minutes as something a kid reads at a glance. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatWhen(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatCountdown(until: number): string {
  const ms = until - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.ceil(mins / 60);
  return `in ${hours}h`;
}
