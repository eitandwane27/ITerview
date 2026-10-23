import { createRoot } from 'react-dom/client';
import SignInTransition from '../../src/components/SignInTransition';

const requested = new URLSearchParams(window.location.search).get('phase');
const phase = ['account', 'dashboard', 'complete'].includes(requested) ? requested : 'account';

createRoot(document.getElementById('root')).render(<SignInTransition phase={phase} />);
