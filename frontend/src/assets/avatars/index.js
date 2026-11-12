import artwork from './profile-avatars.png';

// Pixel bounds in the supplied 1122 × 1402 artwork. Reuse its clean, large fox
// portrait so the selection ring/check in the reference never enters the asset.
export const PROFILE_AVATARS = [
  { id: 'robot', label: 'Robot', bounds: [81, 419, 205, 192] },
  { id: 'fox', label: 'Fox', bounds: [59, 144, 226, 216] },
  { id: 'cat', label: 'Cat', bounds: [586, 419, 205, 192] },
  { id: 'frog', label: 'Frog', bounds: [838, 419, 204, 191] },
  { id: 'penguin', label: 'Penguin', bounds: [81, 631, 205, 194] },
  { id: 'bear', label: 'Bear', bounds: [332, 632, 205, 195] },
  { id: 'rabbit', label: 'Rabbit', bounds: [586, 632, 205, 195] },
  { id: 'owl', label: 'Owl', bounds: [838, 632, 204, 195] },
];

export const DEFAULT_AVATAR = 'fox';
export const getProfileAvatar = (id) =>
  PROFILE_AVATARS.find((avatar) => avatar.id === id) ||
  PROFILE_AVATARS.find((avatar) => avatar.id === DEFAULT_AVATAR);

export function getAvatarStyle(id) {
  const { bounds: [x, y, width, height] } = getProfileAvatar(id);
  return {
    backgroundImage: `url("${artwork}")`,
    backgroundSize: `${1122 / width * 100}% ${1402 / height * 100}%`,
    backgroundPosition: `${x / (1122 - width) * 100}% ${y / (1402 - height) * 100}%`,
  };
}
