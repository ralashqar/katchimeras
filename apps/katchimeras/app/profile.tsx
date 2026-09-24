import { Redirect } from 'expo-router';
import { lifeInputRoute } from '@/components/product/life-input-route';

function ProfileRoute() {
  return <Redirect href="/(tabs)/today?customize=1" />;
}

// A life-input screen, kept but out of the game (`constants/product-scope.ts`).
export default lifeInputRoute(ProfileRoute);
