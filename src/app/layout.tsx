import './globals.css';
import AuthLandingRelay from './AuthLandingRelay';

export const metadata={title:'ACDMS – Census Data Management',manifest:'/manifest.json'};

export default function L({children}:{children:React.ReactNode}){return(<html lang="en"><body><AuthLandingRelay/>{children}<script dangerouslySetInnerHTML={{__html:"if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')"}}/></body></html>)}
