import {useEffect} from 'react';
import {Footer, Header} from './components/Chrome';
import {Contact} from './components/Contact';
import {Earthrise} from './components/Earthrise';
import {Expedition} from './components/Expedition';
import {Manifest} from './components/Manifest';
import {ReturnTrip} from './components/ReturnTrip';
import {useReducedMotion} from './hooks/useReducedMotion';
import {startScroll} from './lib/scroll';

export default function App() {
  const reduced = useReducedMotion();
  useEffect(() => startScroll(reduced), [reduced]);

  return (
    <>
      <Header />
      <main>
        <Earthrise />
        <ReturnTrip />
        <Expedition />
        <Manifest />
        <Contact />
      </main>
      <Footer />
      <div aria-hidden="true" className="pointer-events-none fixed -inset-[10%] z-[60] opacity-[0.06] mix-blend-overlay grain" />
    </>
  );
}
