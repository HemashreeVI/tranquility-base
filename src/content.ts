/**
 * Every word on the page. Each project is pinned to a real country — the
 * landing site is a real city, picked because it fits the project.
 */

export const owner = {
  name: 'HemashreeVI',
  github: 'https://github.com/HemashreeVI',
  site: 'https://hemashreevi.github.io',
};

export const nav = [
  {label: 'Return', href: '#return'},
  {label: 'Expedition', href: '#expedition'},
  {label: 'Manifest', href: '#manifest'},
  {label: 'Contact', href: '#contact'},
];

export const hero = {
  title: 'EARTHRISE',
  kicker: 'A portfolio filmed from the Moon',
  veil: 'Scroll to clear the dust',
  site: 'Tranquility Base · 0.67°N 23.47°E',
  scenes: [
    {at: 0.12, label: 'Scene 01', line: 'July 1969. Two people stood here and looked up.'},
    {at: 0.4, label: 'Scene 02', line: 'Everything anyone has ever built is on that blue marble.'},
    {at: 0.62, label: 'Scene 03', line: 'Including these 19 projects. Let’s go and find them.'},
  ],
};

export const returnTrip = {
  eyebrow: 'Return',
  heading: 'Back to Earth, 384,400 km drawn as you scroll.',
  legs: [
    {day: 'Day 7', title: 'Lunar ascent', body: 'The ascent stage lifts off the surface, leaving the descent stage behind as a launch pad.'},
    {day: 'Day 7', title: 'Trans-Earth injection', body: 'A two-and-a-half-minute burn behind the Moon. Next stop: home.'},
    {day: 'Day 9', title: 'The long coast', body: 'Sixty hours falling back toward the Earth, gaining speed the whole way.'},
    {day: 'Day 10', title: 'Orbit insertion', body: 'Instead of splashing down, the Eagle stays in orbit. The real expedition begins.'},
  ],
};

export const expedition = {
  eyebrow: 'Expedition',
  heading: 'Fly the Eagle. Land on every project.',
  body: 'Nineteen beacons, nineteen countries, one project in each. Steer the globe under your lander, line the reticle up with a beacon and touch down. Landing refuels you; running dry drops you to reserve thrust.',
  controls: [
    ['Drag / ← ↑ → ↓ / WASD', 'Steer'],
    ['Space / Land', 'Touch down'],
    ['Esc', 'Release controls'],
  ] as [string, string][],
};

export type Project = {
  repo: string;
  title: string;
  tagline: string;
  body: string;
  stack: string[];
  live?: string;
  country: string;
  /** ISO 3166-1 numeric, matching world-atlas' country ids. */
  iso: string;
  city: string;
  flag: string;
  /** [longitude, latitude] of the landing site. */
  site: [number, number];
  why: string;
};

export const projects: Project[] = [
  {
    repo: 'rootlens', title: 'RootLens', tagline: 'An on-call engineer that never sleeps.',
    body: 'Watches a microservice app, detects failures from live metrics, collects evidence, works out why it broke and fixes it — only within strict limits.',
    stack: ['Python', 'FastAPI', 'Prometheus', 'Docker'],
    country: 'United States', iso: '840', city: 'San Francisco', flag: '🇺🇸', site: [-122.42, 37.77],
    why: 'Where on-call rotations were invented.',
  },
  {
    repo: 'Provena', title: 'Provena', tagline: 'Evidence-first agentic RAG.',
    body: 'Hybrid and graph retrieval, query planning and claim-level verification — every answer traceable to the exact source span it came from.',
    stack: ['Python', 'LangGraph', 'FastAPI', 'Docker'],
    country: 'Switzerland', iso: '756', city: 'Zürich', flag: '🇨🇭', site: [8.54, 47.37],
    why: 'Swiss precision: nothing claimed without proof.',
  },
  {
    repo: 'TriageIQ', title: 'TriageIQ', tagline: 'Support email triage with a human in the loop.',
    body: 'Reads support emails as they arrive, scores urgency, drafts replies from past resolved tickets and waits for an agent to approve — with a local model, so no customer text leaves the laptop.',
    stack: ['Python', 'FastAPI', 'Ollama', 'Docker'],
    country: 'Ireland', iso: '372', city: 'Dublin', flag: '🇮🇪', site: [-6.26, 53.35],
    why: 'Europe’s customer-support capital.',
  },
  {
    repo: 'JarvisAI', title: 'Nova', tagline: 'A tiny 3D robot who lives on top of your screen.',
    body: 'A glossy real-time 3D desktop companion that does your work and feels with you — with mood eyes, dances, and Pip the robo-kitty.',
    stack: ['Python', 'Three.js', 'Ollama'],
    country: 'Japan', iso: '392', city: 'Tokyo', flag: '🇯🇵', site: [139.69, 35.68],
    why: 'The home of kawaii robots.',
  },
  {
    repo: 'smart-grocer', title: 'Smart Grocer', tagline: 'Rack-level sensing to cut fresh-produce waste.',
    body: 'A low-cost portable platform that fuses vision, gas sensing and inventory intelligence for small grocery stores.',
    stack: ['Python', 'YOLO', 'OpenCV', 'ESP32', 'Raspberry Pi'],
    country: 'India', iso: '356', city: 'Bengaluru', flag: '🇮🇳', site: [77.59, 12.97],
    why: 'Built for the neighbourhood kirana store.',
  },
  {
    repo: 'AI_Malocclusion_Detection', title: 'AI Dental X-Ray Analyzer', tagline: 'Explainable findings on panoramic radiographs.',
    body: 'YOLOv9 detection of caries, lesions, bone loss and more, with per-finding HiResCAM explanations, an FDI tooth chart, a PDF report and cost estimates.',
    stack: ['Python', 'YOLOv9', 'HiResCAM', 'Gradio'],
    country: 'Sweden', iso: '752', city: 'Stockholm', flag: '🇸🇪', site: [18.07, 59.33],
    why: 'Home of the dental implant.',
  },
  {
    repo: 'Pit-Wall-an-animated-race-replay', title: 'Pit Wall', tagline: 'Every overtake, undercut and pit stop, replayed.',
    body: 'Pick any race from 2023 onwards and watch it unfold from real GPS data: live track map, animated leaderboard, gaps and tyres.',
    stack: ['JavaScript', 'OpenF1', 'Canvas'], live: 'https://hemashreevi.github.io/pit-wall/',
    country: 'United Kingdom', iso: '826', city: 'Silverstone', flag: '🇬🇧', site: [-1.02, 52.07],
    why: 'The first ever Formula 1 race, 1950.',
  },
  {
    repo: 'PortPilot', title: 'PortPilot', tagline: '“Address already in use” — solved.',
    body: 'Finds what is holding a port — a process or a Docker container — and frees it in one command, instead of the usual netstat-and-Task-Manager hunt.',
    stack: ['Python', 'Docker', 'CLI'], live: 'https://hemashreevi.github.io/PortPilot/',
    country: 'Netherlands', iso: '528', city: 'Rotterdam', flag: '🇳🇱', site: [4.48, 51.92],
    why: 'Europe’s busiest port.',
  },
  {
    repo: 'Pulse-Port', title: 'Pulse', tagline: 'Uptime monitoring with GitHub as the infrastructure.',
    body: 'Actions is the scheduler, the repo is the database, Pages is the status dashboard and Issues is the alerting system. No servers, no SaaS bill.',
    stack: ['GitHub Actions', 'Python', 'D3'], live: 'https://hemashreevi.github.io/pulse/',
    country: 'South Korea', iso: '410', city: 'Seoul', flag: '🇰🇷', site: [126.98, 37.57],
    why: 'The world’s always-online nation.',
  },
  {
    repo: 'devorbit', title: 'DevOrbit', tagline: 'Your developer universe in one tab.',
    body: 'A daily dashboard for GitHub, focus and tech news, plus a Git Lab that turns typed git commands into a living animated commit graph in 2D or 3D.',
    stack: ['React', 'Vite', 'Three.js'], live: 'https://hemashreevi.github.io/devorbit/',
    country: 'Estonia', iso: '233', city: 'Tallinn', flag: '🇪🇪', site: [24.75, 59.44],
    why: 'The most digital country on Earth.',
  },
  {
    repo: 'disaster-response-rover-nodered', title: 'Disaster Response Rover', tagline: 'A cyber-physical rover that decides for itself.',
    body: 'Enters a collapsed building, senses fire, gas and obstacles, decides what to do and drives its actuators — while a live dashboard keeps the rescue team informed.',
    stack: ['Node-RED', 'MQTT', 'Dashboard'],
    country: 'Nepal', iso: '524', city: 'Kathmandu', flag: '🇳🇵', site: [85.32, 27.72],
    why: 'Built for earthquake country.',
  },
  {
    repo: 'smart-day', title: 'Smart Day', tagline: 'To-do, calendar and Gmail assistant — inside your Google account.',
    body: 'Reads your Gmail every five minutes, finds exams, deadlines and interviews, and puts them on your calendar. No server, no subscription.',
    stack: ['Apps Script', 'Gmail', 'Calendar'],
    country: 'Australia', iso: '036', city: 'Sydney', flag: '🇦🇺', site: [151.21, -33.87],
    why: 'First to see each new day.',
  },
  {
    repo: 'BST-Playground', title: 'BST Playground', tagline: 'See the algorithm instead of imagining it.',
    body: 'Animates every comparison and pointer move in a binary search tree — insert, delete with two children, traversals.',
    stack: ['JavaScript', 'SVG'], live: 'https://hemashreevi.github.io/bst-playground/',
    country: 'Brazil', iso: '076', city: 'Manaus', flag: '🇧🇷', site: [-60.02, -3.12],
    why: 'The Amazon: the biggest forest of trees.',
  },
  {
    repo: 'spellCheckerpro', title: 'CompilerSpell', tagline: 'English, checked like a programming language.',
    body: 'Models text as a formal grammar and pushes it through real compiler phases — lexing, parsing, semantic checks — to find spelling and grammar errors.',
    stack: ['JavaScript', 'Compilers', 'NLP'],
    country: 'Greece', iso: '300', city: 'Athens', flag: '🇬🇷', site: [23.73, 37.98],
    why: 'Where grammar was first written down.',
  },
  {
    repo: 'token-meter', title: 'Token Meter', tagline: 'Watch your AI chat spend its context.',
    body: 'Counts tokens live as you type, shows how full the context window is, how many turns are left and how each turn costs more than the last.',
    stack: ['JavaScript', 'Charts'],
    country: 'South Africa', iso: '710', city: 'Cape Town', flag: '🇿🇦', site: [18.42, -33.92],
    why: 'Where the Square Kilometre Array counts the sky.',
  },
  {
    repo: 'Leetcode-Solutions', title: 'LeetCode Solutions', tagline: 'Data structures and algorithms, intuition first.',
    body: 'Java solutions written to be understood: the idea in plain words, the path from brute force to optimal, and the complexity of every one.',
    stack: ['Java', 'DSA'],
    country: 'Indonesia', iso: '360', city: 'Jakarta, Java', flag: '🇮🇩', site: [106.85, -6.2],
    why: 'Written in Java — so it lives on Java.',
  },
  {
    repo: 'FRONTEND_FOOD_ORDERING_SYSTEM', title: 'Tasty Bites', tagline: 'A playful food-ordering site with a live rider map.',
    body: 'Browse the menu, customise your dish, check out in three steps and watch your rider travel the map to your door.',
    stack: ['JavaScript', 'GSAP', 'Lenis'], live: 'https://hemashreevi.github.io/FRONTEND_FOOD_ORDERING_SYSTEM/',
    country: 'Mexico', iso: '484', city: 'Mexico City', flag: '🇲🇽', site: [-99.13, 19.43],
    why: 'A UNESCO-listed cuisine.',
  },
  {
    repo: 'IBM_PDF_READER', title: 'PDF Q&A Bot', tagline: 'Chat with your PDFs, with page-level citations.',
    body: 'A lightweight retrieval-augmented generation app that runs in Colab: upload PDFs, ask in plain English, get streamed answers grounded in your documents.',
    stack: ['Python', 'RAG', 'Colab'],
    country: 'Canada', iso: '124', city: 'Toronto', flag: '🇨🇦', site: [-79.38, 43.65],
    why: 'A deep-learning research hub.',
  },
  {
    repo: 'INTRUSION-DETECTION-AND-THREAT-MODELLING', title: 'Intrusion Detection', tagline: 'Spotting attacks and modelling threats.',
    body: 'An intrusion-detection system paired with threat modelling: find malicious traffic, then map how an attacker could get in.',
    stack: ['Security', 'ML'],
    country: 'Iceland', iso: '352', city: 'Reykjavík', flag: '🇮🇸', site: [-21.94, 64.15],
    why: 'An island fortress for data centres.',
  },
];

export const contact = {
  eyebrow: 'Mission control',
  heading: 'Want to fly the next mission together?',
  body: 'Every project here is open source. Open an issue, star a repo, or just say hello.',
};
