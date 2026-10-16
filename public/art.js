// Original vector portraits. Artwork never encodes a player's secret role.
export function portrait(seed = 0) {
  const n = typeof seed === 'number' ? seed : [...String(seed)].reduce((a,c)=>a+c.charCodeAt(0),0);
  const i = n % 8;
  const coats = ['#324c55','#5b4848','#454e3c','#584936','#3e485e','#3f5551','#624b3a','#504758'];
  const skin = ['#c4ac8c','#a78b6b','#d3b69b','#a2917a'][i%4];
  const hair = [
    '<path d="M27 49Q19 16 46 16Q78 8 78 48L65 42L61 28L40 35L34 49Z"/>',
    '<path d="M23 76V35Q28 11 52 16Q79 12 79 43V78L67 70V40L40 31L33 76Z"/>',
    '<path d="M26 44L28 22Q48 6 70 23L78 48L66 35L37 37Z"/>',
    '<path d="M25 49Q12 36 28 25Q23 9 41 17Q52 3 64 19Q83 12 78 32Q91 47 72 52L66 34L39 35Z"/>',
    '<path d="M25 49Q20 17 45 18L73 10L77 47L59 29L34 41Z"/>',
    '<path d="M24 73L27 29Q49 7 74 29L79 73L67 62L63 33L38 33L35 63Z"/>',
    '<path d="M27 40Q30 14 51 17Q71 14 75 40L63 29L39 29Z"/>',
    '<path d="M25 51L24 26L41 12L67 17L79 33L74 51L64 29L37 40Z"/>'
  ];
  return `<svg class="portrait" viewBox="0 0 100 116" aria-hidden="true" focusable="false"><rect width="100" height="116" fill="${coats[i]}"/><path d="M0 19H100M0 40H100M0 61H100M0 82H100" stroke="#ede0bd" opacity=".09"/><path d="M7 116L12 91Q24 79 40 78H60Q79 80 88 94L96 116Z" fill="#131e23"/><path d="M40 72H60V88L50 100L40 88Z" fill="${skin}"/><path d="M37 80L50 100L32 91L24 116M63 80L50 100L68 91L76 116" fill="#d4c7a8"/><path d="M48 99H52L57 116H43Z" fill="${coats[i]}"/><g fill="#162127">${hair[i]}</g><path d="M31 43Q29 28 50 27Q72 28 70 44L67 66Q62 80 50 81Q35 77 32 63Z" fill="${skin}"/><path d="M51 32L54 63H61L52 69V79Q69 73 68 58L70 42Z" fill="#18252a" opacity=".2"/><g fill="#162127">${hair[i]}</g><path d="M36 49H44M57 49H65" stroke="#263337" stroke-width="2"/><path d="M43 69H57" stroke="#695b50" stroke-width="2"/>${i%3===0?'<path d="M32 46H46V55H32ZM54 46H68V55H54ZM46 49H54" fill="none" stroke="#1b292e" stroke-width="2"/>':''}</svg>`;
}
