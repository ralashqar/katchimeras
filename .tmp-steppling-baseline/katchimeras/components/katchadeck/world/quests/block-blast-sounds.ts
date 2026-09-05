import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';

export type BlockBlastSound = 'place' | 'clear' | 'combo' | 'game_over';
export type BlockBlastSoundPlayers = Partial<Record<BlockBlastSound, AudioPlayer>>;

const TONES: Record<BlockBlastSound, string> = {
  place: 'data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAoA8AAEAfAAACABAAZGF0YfAAAAAAAFsPcxp3Hnkapg/vADvyYOcg43rmavA8/kIM1RZCG4EYbA+AAi317+pg5pTo1fDe/HgJWBP6F0cW0Q6rA8/3WO6u6e7qoPHn+wAHBRCoFNAT2Q1uBBv6k/EC7X/txfJW++EE5AxVEScRiAzMBAz8l/RS8D7wQPQs+x4D/QkLDlMO5ArDBKH9XveT8yTzC/Zm+7kBWAfUCl4L9AhYBNT+4fm+9ib2HvgC/LcA+gS4B1EIvwaMA6X/GPzJ+Tz5c/r9/BgA6wLABDUFTARjAhIA/v2r/Fv8Av1T/t3/LwH1ARQCowHhABoAjv9c/3v/w/8=',
  clear: 'data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAoA8AAEAfAAACABAAZGF0YfAAAAAAAOYR+hxQHfYS4QFp8Ozkf+N77Gn8XA0kGYwb4hMgBcf01OiK5fLrhvkwCTMVQRkKFKUHu/jF7A/oJ+xf93sFSRGLFn0TbQks/J/w7uoH7ff1UgKHDYsTTxJ3Cgj/QfQH7n3uSfXG/wwKYRCYEMoKQQGP9znxb/BO9eL98QYvDXIOcQrPAnD6Y/TC8vj1rPxPBBQK+gt7Ca0Dz/xm91b1NPcl/DgCMAdRCf0H3wOa/iX6Dfju+Ef8uwCeBJQGDgZqA8b/hPzH+gz7C/3i/3cC5QPJA1wCTABt/mX9cf1g/rD/0QBhAUsBxQAqAMz/x/8=',
  combo: 'data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAoA8AAEAfAAACABAAZGF0YfAAAAAAALUVuR4lFiMB2Otc4t7pzv2iEoUcChYtA9ruo+Qi6u77sw8uGp0V4QS28Qfnt+pl+u0MvxfiFEAGY/R+6ZbrMflZCkEV4RNIB9z2AOy57FX4/ge+Ep8S+QcZ+YPuGO7O9+EFPhAkEVYIFPv+8Kzvm/cIBMsNeA9fCMr8Z/Nu8br3dgJuC6QNGQg2/rb1U/Mn+DEBLwmvC4YHVf/j91X13/g5ABYHowmsBiUA5vlp99v5kv8rBYgHjwWkALj7h/kW+zv/dANpBTcE0gBR/ab7ivw1//kBTQOpArAArf68/TD+f/++AD8B7QA+AMX/wf8=',
  game_over: 'data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAoA8AAEAfAAACABAAZGF0YfAAAAAAALIYlx0sC0zwNeK/6wQF5xkZGs8FVO3x473wRQkSGhwW4gBg63TmqPWrDEoZ1RGO/GrqkelP+igPrxd6DfH4ZOoV7Yb+uBBoFTwJIPY069DwKQJjEaISSAUn9LvskPQeBTkRiw/GAQTz0e4m+FQHVRBTDNb+r/JM8Wr7wwjWDicJjPwU8wD0OP5vCeQMMwb3+hj0v/Z2AGUJqAqcAxn6m/Ve+RECughNCH8B6/l197f7AgOJB/0F9P9f+n75p/1IA/YF4gMJ/1z7jPsU/+8CKAQeAsH+xPx2/ez/CAJGAtEAGP9z/hb/JgCvAHoADwA=',
};
const playerReleases = new WeakMap<AudioPlayer, () => void>();

export function createBlockBlastSoundPlayers(): BlockBlastSoundPlayers {
  return {};
}

export function disposeBlockBlastSoundPlayers(players: BlockBlastSoundPlayers) {
  Object.values(players).forEach((player) => {
    if (!player) return;
    player.remove();
    playerReleases.get(player)?.();
    playerReleases.delete(player);
  });
}

export function playBlockBlastSound(players: BlockBlastSoundPlayers, sound: BlockBlastSound) {
  let player = players[sound];
  if (!player) {
    player = createAudioPlayer(TONES[sound]);
    players[sound] = player;
    playerReleases.set(player, acquireLifecycleResource('audio_player', `block-blast:${sound}`));
  }
  void player.seekTo(0).then(() => player.play()).catch(() => undefined);
}
