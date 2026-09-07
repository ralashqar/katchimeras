import AdventureWorld from './adventure-world';
import { FocusedScreen } from './focused-screen';

export default function World() {
  return <FocusedScreen><AdventureWorld /></FocusedScreen>;
}
