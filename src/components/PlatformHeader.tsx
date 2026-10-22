'use client';

import Image from 'next/image';
import {useEffect, useState} from 'react';

const links = [
  {label: 'Explore', href: '/#explore'},
  {label: 'Signals', href: '/#signals'},
  {label: 'Nigeria guide', href: '/nigeria'},
  {label: 'Find my ward', href: '/geography'},
  {label: 'Submit household', href: '/citizen/form'},
];

export default function PlatformHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`platform-header${menuOpen ? ' platform-header-open' : ''}`}>
      <a className="platform-brand" href="/" onClick={closeMenu} aria-label="Naija Signal home">
        <Image
          src="/naija-signal-logo.png"
          alt="Naija Signal"
          width={746}
          height={334}
          priority
        />
      </a>
      <button
        className="platform-menu-toggle"
        type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        aria-controls="platform-navigation"
        onClick={() => setMenuOpen(open => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav
        className="platform-navigation"
        id="platform-navigation"
        aria-label="Main navigation"
      >
        {links.map(link => (
          <a href={link.href} key={link.href} onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        <a className="platform-portal-link" href="/login" onClick={closeMenu}>
          Portal <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </header>
  );
}
