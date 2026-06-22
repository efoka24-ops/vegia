export default function Shield({ size = 24, fill = '#0A5C42', stroke = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z" fill={fill} />
      <path d="M8 12l3 3 5-6" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
