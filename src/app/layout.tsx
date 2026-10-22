import './globals.css';
import './nigeria-guide.css';
import AuthLandingRelay from './AuthLandingRelay';
import PlatformHeader from '@/components/PlatformHeader';

export const metadata={
 title:"Naija Signal: Nigeria's Civic Data",
 manifest:'/manifest.json',
 icons:{icon:'/naija-signal-favicon.png',shortcut:'/naija-signal-favicon.png',apple:'/naija-signal-favicon.png'},
};

export default function L({children}:{children:React.ReactNode}){return(<html lang="en"><body><a className="platform-skip-link" href="#main-content">Skip to content</a><AuthLandingRelay/><PlatformHeader/><div id="main-content">{children}</div><script dangerouslySetInnerHTML={{__html:"if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')"}}/></body></html>)}
