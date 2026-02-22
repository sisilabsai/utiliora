interface AdSlotProps {
  label?: string;
}

export function AdSlot({ label = "Advertisement" }: AdSlotProps) {
  return (
    <aside className="ad-slot" aria-label={label}>
      <p>{label}</p>
      <small>AdSense slot placeholder</small>
    </aside>
  );
}
