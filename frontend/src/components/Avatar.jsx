const PALETTE = [
  'from-orange-500 to-rose-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-500 to-teal-600',
  'from-fuchsia-500 to-purple-600',
  'from-amber-400 to-orange-600',
  'from-cyan-400 to-blue-600',
  'from-lime-400 to-green-600',
  'from-pink-500 to-red-600',
];

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
};

function hash(text) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

// Avatar généré à partir du pseudo (couleur stable + initiales).
export default function Avatar({ username = '?', size = 'md', className = '' }) {
  const gradient = PALETTE[hash(username.toLowerCase()) % PALETTE.length];
  const parts = username.split(/[._-]/).filter(Boolean);
  const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : username.slice(0, 2)).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-bold text-white ${gradient} ${SIZES[size]} ${className}`}
    >
      {initials}
    </span>
  );
}
