import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { KatchaToast } from '@/components/katchadeck/ui/katcha-toast';

type MicrocopyToastProps = {
  message: string | null;
  busy?: boolean;
};

// Compatibility name for Today callers. Shared feedback now uses KatchaToast.
export function MicrocopyToast({ message, busy = false }: MicrocopyToastProps) {
  return (
    <KatchaSurfaceProvider surface="night">
      <KatchaToast busy={busy} message={message} />
    </KatchaSurfaceProvider>
  );
}
