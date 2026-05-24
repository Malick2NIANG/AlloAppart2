export default function AlloVerifieBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-[#b58900] text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${className}`}
    >
      <i className="fa-solid fa-check text-[8px]" />
      AlloVérifié
    </span>
  );
}
